"use server";

import { google } from "@ai-sdk/google";
import { createStreamableValue } from "@ai-sdk/rsc";
import { generateText } from "ai";

import type { MusicResult } from "@/lib/schemas";
import {
  musicSearchLimiter,
  identifyEntityLimiter,
  checkLimit,
} from "@/lib/rate-limit";
import { getRecommendations, searchTrack } from "@/lib/lastfm";

const VARIANT_TOKENS = [
  "live",
  "remaster",
  "remastered",
  "karaoke",
  "tribute",
  "cover",
  "acoustic",
  "instrumental",
  "soundtrack",
  "from v.a",
  "v.a",
  "version",
  "radio edit",
  "edit",
  "mix",
  "demo",
  "re-recorded",
  "deluxe",
] as const;

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/\s+/g, " ").trim();
}

function trackKey(track: MusicResult): string {
  return `${normalizeText(track.name)}::${normalizeText(track.artist)}`;
}

function isVariantLikeTitle(title: string): boolean {
  const normalized = normalizeText(title);
  return VARIANT_TOKENS.some((token) => normalized.includes(token));
}

function userAskedForVariant(query: string): boolean {
  const normalized = normalizeText(query);
  return VARIANT_TOKENS.some((token) => normalized.includes(token));
}

function dedupeTracks(tracks: MusicResult[]): MusicResult[] {
  const seen = new Set<string>();
  const unique: MusicResult[] = [];

  for (const track of tracks) {
    const key = trackKey(track);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(track);
  }

  return unique;
}

// ── AI identifies a vague music query via Google Search ───────────────────────
async function identifySong(userInput: string) {
  const rl = await checkLimit(identifyEntityLimiter);
  if (!rl.allowed) {
    throw new Error(`AI identify rate limited — retry in ${rl.retryAfter}s`);
  }

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: `The user typed: "${userInput}"
They are looking for a song or music track.
Identify the most likely canonical track title and primary artist they mean.
Prefer the official studio release title.
Do not return compilation, remix, karaoke, live, tribute, or soundtrack variants unless the user explicitly asked for one.
Respond ONLY with valid JSON, no markdown:
{ "track": "...", "artist": "...", "confidence": "high" | "medium" | "low" }`,
    tools: { google_search: google.tools.googleSearch({}) },
    maxOutputTokens: 200,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as {
    track: string;
    artist: string;
    confidence: string;
  };
}

function toCanonicalSeed(track: string, artist: string): MusicResult {
  return {
    name: track.trim(),
    artist: artist.trim(),
    url: null,
    tags: [],
  };
}

// ── Main music server action ──────────────────────────────────────────────────
export async function musicSearch(query: string) {
  const trimmed = query.toLowerCase().trim();
  if (!trimmed) {
    return { ok: false as const, error: "Query cannot be empty." };
  }

  const allowVariantTitles = userAskedForVariant(trimmed);

  // Rate limit (shared Redis)
  const rl = await checkLimit(musicSearchLimiter);
  if (!rl.allowed) {
    return { ok: false as const, error: `Rate limited — retry in ${rl.retryAfter}s` };
  }

  // Step 1: Resolve intended track via AI first (primary path)
  let matchedTrack: MusicResult | null = null;
  let recommendationSeed: MusicResult | null = null;
  let identifiedTrack: { track: string; artist: string; confidence: string } | null = null;
  let entityName: string | null = null;

  try {
    const identified = await identifySong(trimmed);
    if (identified.track && identified.artist) {
      identifiedTrack = identified;
      entityName = `${identified.track} — ${identified.artist}`;
      recommendationSeed = toCanonicalSeed(identified.track, identified.artist);
      matchedTrack = await searchTrack(`${identified.artist} ${identified.track}`);

      // Keep the displayed entity canonical unless the user explicitly requested variants.
      if (!allowVariantTitles) {
        matchedTrack = {
          ...toCanonicalSeed(identified.track, identified.artist),
          url: matchedTrack?.url ?? null,
          tags: matchedTrack?.tags ?? [],
          playcount: matchedTrack?.playcount,
        };
      }
    }
  } catch {
    // AI identify failed; direct search fallback below
  }

  // Step 2: Fallback to direct Last.fm search when AI did not resolve anything
  if (!matchedTrack) {
    matchedTrack = await searchTrack(trimmed);
    if (matchedTrack) {
      recommendationSeed = matchedTrack;
    }
  }

  if (!recommendationSeed && identifiedTrack) {
    recommendationSeed = toCanonicalSeed(identifiedTrack.track, identifiedTrack.artist);
  }

  if (!matchedTrack && !recommendationSeed) {
    return { ok: false as const, error: "Could not find that track." };
  }

  const musicStream = createStreamableValue<string>("");

  (async () => {
    try {
      const seed = recommendationSeed ?? matchedTrack!;
      const primary = await getRecommendations(
        seed.artist,
        seed.name,
      );

      // Stream the matched entity first
      const entityCard: MusicResult = primary.entity ?? matchedTrack ?? seed;
      musicStream.update(JSON.stringify({ type: "entity", data: entityCard }));
      await new Promise((r) => setTimeout(r, 80));

      // Expand recommendations using 3 seeds total: the main track + top 2 similar tracks.
      const filteredPrimarySimilar = primary.similar.filter(
        (track) => allowVariantTitles || !isVariantLikeTitle(track.name),
      );
      const extraSeeds = dedupeTracks(filteredPrimarySimilar).slice(0, 2);

      const expandedSimilar: MusicResult[] = [...filteredPrimarySimilar];

      for (const extraSeed of extraSeeds) {
        const next = await getRecommendations(extraSeed.artist, extraSeed.name);
        const cleaned = next.similar.filter(
          (track) => allowVariantTitles || !isVariantLikeTitle(track.name),
        );
        expandedSimilar.push(...cleaned);
      }

      const seedKeys = new Set<string>([trackKey(seed)]);
      const finalSimilar = dedupeTracks(expandedSimilar)
        .filter((track) => !seedKeys.has(trackKey(track)))
        .slice(0, 24);

      // Stream similar tracks.
      for (const track of finalSimilar) {
        musicStream.update(
          JSON.stringify({ type: "similar", data: track }),
        );
        await new Promise((r) => setTimeout(r, 80));
      }

      musicStream.done();
    } catch {
      musicStream.done();
    }
  })();

  return {
    ok: true as const,
    query: trimmed,
    entityName,
    musicStream: musicStream.value,
  };
}
