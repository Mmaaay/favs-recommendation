import type { MusicResult } from "@/lib/schemas";
import { lastfmLimiter, checkLimit } from "@/lib/rate-limit";

// ── 1. API key — validated at module load, never falls back to "" ─────────────
if (!process.env.LASTFM_API_KEY) throw new Error("LASTFM_API_KEY is not set");
// Safe to assert non-null: the throw above guarantees it is set before any call
const LASTFM_API_KEY = process.env.LASTFM_API_KEY as string;

// ── 2. Allowlist of caller-supplied parameter keys ────────────────────────────
const ALLOWED_PARAM_KEYS = new Set([
  "method",
  "artist",
  "track",
  "limit",
  "page",
  "autocorrect",
  "user",
  "tag",
]);

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/" as const;

function lastfmUrl(params: Record<string, string>): string {
  // ── 2. Strip any key not in the allowlist (prevents api_key/format override)
  const sanitized = Object.fromEntries(
    Object.entries(params).filter(([k]) => ALLOWED_PARAM_KEYS.has(k)),
  );

  // ── 3. Validate values: max 200 chars, safe characters only ─────────────────
  for (const [k, v] of Object.entries(sanitized)) {
    if (v.length > 200) throw new Error(`Param "${k}" exceeds maximum length`);
    if (!/^[\w\s\-.,'&()]+$/u.test(v))
      throw new Error(`Param "${k}" contains invalid characters`);
  }

  // api_key and format are set after the sanitized spread so they cannot be overridden
  const sp = new URLSearchParams({
    ...sanitized,
    api_key: LASTFM_API_KEY,
    format: "json",
  });

  // ── 4. Pin hostname — ensure nothing tampered with the base URL ──────────────
  const url = new URL(`${LASTFM_BASE}?${sp.toString()}`);
  if (url.hostname !== "ws.audioscrobbler.com") {
    throw new Error("Last.fm URL integrity check failed");
  }

  return url.toString();
}

// ── Rate-limited Last.fm fetch wrapper ────────────────────────────────────────
async function lastfmFetch(url: string): Promise<Record<string, unknown>> {
  const rl = await checkLimit(lastfmLimiter);
  if (!rl.allowed) {
    throw new Error(`Last.fm rate limited — retry in ${rl.retryAfter}s`);
  }
  const res = await fetch(url);
  return res.json();
}



function formatTrack(
  t: Record<string, unknown>,
  artistFallback?: string,
): MusicResult | null {
  const name = (t.name as string) ?? "";
  if (!name) return null;

  const artist =
    typeof t.artist === "string"
      ? t.artist
      : typeof t.artist === "object" && t.artist !== null
        ? ((t.artist as Record<string, unknown>).name as string) ?? artistFallback ?? "Unknown"
        : artistFallback ?? "Unknown";

  const playcount = t.playcount
    ? Number(t.playcount)
    : t.listeners
      ? Number(t.listeners)
      : undefined;

  const url = (t.url as string) ?? null;

  const tags: string[] = [];
  if (t.toptags && typeof t.toptags === "object") {
    const tagArr = (t.toptags as Record<string, unknown>).tag;
    if (Array.isArray(tagArr)) {
      for (const tag of tagArr.slice(0, 3)) {
        if (typeof tag === "object" && tag !== null) {
          tags.push((tag as Record<string, unknown>).name as string);
        }
      }
    }
  }

  const match = typeof t.match === "number" ? t.match : t.match ? Number(t.match) : undefined;

  return {
    name,
    artist,
    url,
    playcount,
    tags,
  };
}

// ── Search for a track ────────────────────────────────────────────────────────
export async function searchTrack(
  query: string,
): Promise<MusicResult | null> {
  const data = await lastfmFetch(
    lastfmUrl({ method: "track.search", track: query, limit: "1" }),
  );

  const results = (data.results as Record<string, unknown>);
  if (!results) return null;

  const trackMatches = results.trackmatches as Record<string, unknown>;
  if (!trackMatches) return null;

  const tracks = trackMatches.track;
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  return formatTrack(tracks[0] as Record<string, unknown>);
}

// ── Get similar tracks ────────────────────────────────────────────────────────
export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 10,
): Promise<MusicResult[]> {
  const data = await lastfmFetch(
    lastfmUrl({
      method: "track.getSimilar",
      artist,
      track,
      limit: String(limit),
      autocorrect: "1",
    }),
  );

  const similar = data.similartracks as Record<string, unknown> | undefined;
  if (!similar) return [];

  const tracks = similar.track;
  if (!Array.isArray(tracks)) return [];

  return tracks
    .map((t: unknown) => formatTrack(t as Record<string, unknown>))
    .filter((t): t is MusicResult => t !== null);
}

// ── Get track info (for tags/metadata) ────────────────────────────────────────
export async function getTrackInfo(
  artist: string,
  track: string,
): Promise<MusicResult | null> {
  const data = await lastfmFetch(
    lastfmUrl({
      method: "track.getInfo",
      artist,
      track,
      autocorrect: "1",
    }),
  );

  const t = data.track as Record<string, unknown> | undefined;
  if (!t) return null;

  return formatTrack(t);
}

// ── Get similar artists' top tracks ───────────────────────────────────────────
export async function getSimilarArtistTracks(
  artist: string,
  limit = 5,
): Promise<MusicResult[]> {
  const data = await lastfmFetch(
    lastfmUrl({
      method: "artist.getSimilar",
      artist,
      limit: String(limit),
      autocorrect: "1",
    }),
  );

  const similar = data.similarartists as Record<string, unknown> | undefined;
  if (!similar) return [];

  const artists = similar.artist;
  if (!Array.isArray(artists)) return [];

  const results: MusicResult[] = [];

  // Get top track from each similar artist
  for (const a of artists.slice(0, limit)) {
    const artistName = (a as Record<string, unknown>).name as string;
    if (!artistName) continue;

    const topData = await lastfmFetch(
      lastfmUrl({
        method: "artist.getTopTracks",
        artist: artistName,
        limit: "2",
        autocorrect: "1",
      }),
    );

    const topTracks = topData.toptracks as Record<string, unknown> | undefined;
    if (!topTracks) continue;

    const trackArr = topTracks.track;
    if (!Array.isArray(trackArr)) continue;

    for (const t of trackArr.slice(0, 2)) {
      const formatted = formatTrack(t as Record<string, unknown>, artistName);
      if (formatted) results.push(formatted);
    }
  }

  return results;
}

// ── Combined recommendation: similar tracks + similar artist tracks ───────────
export async function getRecommendations(
  artist: string,
  track: string,
): Promise<{ entity: MusicResult | null; similar: MusicResult[]; artistPicks: MusicResult[] }> {
  const [trackInfo, similar, artistPicks] = await Promise.all([
    getTrackInfo(artist, track),
    getSimilarTracks(artist, track, 10),
    getSimilarArtistTracks(artist, 4),
  ]);

  return { entity: trackInfo, similar, artistPicks };
}
