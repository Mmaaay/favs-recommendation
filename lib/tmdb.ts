import type { MovieResult } from "@/lib/schemas";
import { tmdbLimiter, checkLimit } from "@/lib/rate-limit";

// ── Genre ID maps ─────────────────────────────────────────────────────────────
const MOVIE_GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "sci-fi": 878,
  "science fiction": 878,
  "tv movie": 10770,
  thriller: 53,
  war: 10752,
  western: 37,
};

const TV_GENRE_MAP: Record<string, number> = {
  "action & adventure": 10759,
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  "sci-fi & fantasy": 10765,
  "sci-fi": 10765,
  fantasy: 10765,
  soap: 10766,
  talk: 10767,
  "war & politics": 10768,
  war: 10768,
  western: 37,
};

// ── Reverse maps: genre ID → name ─────────────────────────────────────────────
const MOVIE_GENRE_BY_ID: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

const TV_GENRE_BY_ID: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

// ── Input classification ──────────────────────────────────────────────────────
const KNOWN_GENRES = [
  "action",
  "comedy",
  "drama",
  "horror",
  "romance",
  "thriller",
  "sci-fi",
  "fantasy",
  "animation",
  "crime",
  "documentary",
  "mystery",
  "adventure",
  "family",
  "history",
  "music",
  "war",
  "western",
];

export function isKnownGenre(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return (
    KNOWN_GENRES.includes(lower) ||
    lower in MOVIE_GENRE_MAP ||
    lower in TV_GENRE_MAP
  );
}

export type InputClass = "genre" | "exact_name" | "vague";

export async function classifyInput(input: string): Promise<InputClass> {
  const lower = await sanitize(input);
  if (KNOWN_GENRES.some((g) => lower.includes(g))) return "genre";
  const fillers = [
    "that",
    "the",
    "about",
    "with",
    "where",
    "show",
    "movie",
    "film",
  ];
  const words = lower.split(/\s+/);
  const hasFillers = fillers.some((w) => words.includes(w));
  if (!hasFillers && words.length <= 5) return "exact_name";
  return "vague";
}

// ── Sanitize ──────────────────────────────────────────────────────────────────
export async function sanitize(s: string): Promise<string> {
  return s.toLowerCase().trim();
}

// ── Shuffle (Fisher-Yates) ────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────

// 1. API key — validated at module load, never falls back to ""
if (!process.env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not set");
const TMDB_API_KEY = process.env.TMDB_API_KEY as string;

// 2. Allowlist of caller-supplied query-param keys
const ALLOWED_TMDB_PARAM_KEYS = new Set([
  "query",
  "with_genres",
  "sort_by",
  "page",
  "include_adult",
  "include_video",
  "primary_release_year",
  "first_air_date_year",
]);

const TMDB_BASE = process.env.TMDB_URL;
const RECOMMENDATION_LIMIT = 30;
const DISCOVER_LIMIT = 36;

function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  // Validate path: must start with / and contain only safe characters
  if (!/^\/[\w\-/]+$/.test(path))
    throw new Error(`Invalid TMDB path: "${path}"`);

  // 2. Strip any key not in the allowlist (prevents api_key/language override)
  const sanitized = Object.fromEntries(
    Object.entries(params).filter(([k]) => ALLOWED_TMDB_PARAM_KEYS.has(k)),
  );

  // 3. Validate values: max 200 chars, safe characters only
  for (const [k, v] of Object.entries(sanitized)) {
    if (v.length > 200) throw new Error(`Param "${k}" exceeds maximum length`);
    if (!/^[\w\s\-.,'&()]+$/u.test(v))
      throw new Error(`Param "${k}" contains invalid characters`);
  }

  // api_key and language are set after the sanitized spread so they cannot be overridden
  const sp = new URLSearchParams({
    ...sanitized,
    api_key: TMDB_API_KEY,
    language: "en-US",
  });

  // 4. Pin hostname — ensure nothing tampered with the base URL
  const url = new URL(`${TMDB_BASE}${path}?${sp.toString()}`);
  if (url.hostname !== "api.themoviedb.org")
    throw new Error("TMDB URL integrity check failed");

  return url.toString();
}

// ── Rate-limited TMDB fetch wrapper ───────────────────────────────────────────
async function tmdbFetch(url: string): Promise<Record<string, unknown>> {
  const rl = await checkLimit(tmdbLimiter);
  if (!rl.allowed) {
    throw new Error(`TMDB rate limited — retry in ${rl.retryAfter}s`);
  }
  const res = await fetch(url);
  return res.json();
}

function formatItem(
  r: Record<string, unknown>,
  mediaType: "movie" | "tv" = "movie",
): MovieResult {
  const title = (r.title ?? r.name ?? "Unknown") as string;
  const year = ((r.release_date ?? r.first_air_date ?? "") as string).slice(
    0,
    4,
  );
  const rating =
    typeof r.vote_average === "number" ? r.vote_average.toFixed(1) : "N/A";
  const id = typeof r.id === "number" ? r.id : undefined;
  const posterPath = r.poster_path as string | null;
  const overview = (r.overview ?? "") as string;
  const genreIds = (r.genre_ids ?? []) as number[];
  const genreMap = mediaType === "tv" ? TV_GENRE_BY_ID : MOVIE_GENRE_BY_ID;
  const genres = genreIds.map((id) => genreMap[id]).filter(Boolean);
  const episodeCount =
    mediaType === "tv" && typeof r.number_of_episodes === "number"
      ? r.number_of_episodes
      : null;

  return {
    id,
    title,
    year,
    rating,
    poster: posterPath ? `https://image.tmdb.org/t/p/w300${posterPath}` : null,
    genres,
    description: overview,
    mediaType: mediaType === "tv" ? "tv_series" : "movie",
    episodeCount,
  };
}

async function enrichTvEpisodeCounts(
  items: MovieResult[],
): Promise<MovieResult[]> {
  const tvItems = items.filter(
    (item) => item.mediaType === "tv_series" && typeof item.id === "number",
  );
  if (tvItems.length === 0) return items;

  const episodeById = new Map<number, number | null>();
  await Promise.all(
    tvItems.map(async (item) => {
      const detail = (await tmdbFetch(
        tmdbUrl(`/tv/${item.id as number}`),
      )) as Record<string, unknown>;
      episodeById.set(
        item.id as number,
        typeof detail.number_of_episodes === "number"
          ? detail.number_of_episodes
          : null,
      );
    }),
  );

  return items.map((item) => {
    if (item.mediaType !== "tv_series" || typeof item.id !== "number")
      return item;
    return {
      ...item,
      episodeCount: episodeById.get(item.id) ?? item.episodeCount ?? null,
    };
  });
}

export async function fetchByName(
  name: string,
  type: "movie" | "tv_series" | "both" = "both",
): Promise<{
  entity: MovieResult | null;
  genres: string[];
  results: MovieResult[];
} | null> {
  if (type === "both") {
    const [movieData, tvData] = await Promise.all([
      fetchByName(name, "movie"),
      fetchByName(name, "tv_series"),
    ]);
    if (!movieData && !tvData) return null;
    const entities = [movieData?.entity, tvData?.entity].filter(
      (e): e is MovieResult => !!e,
    );
    const allResults = [
      ...(movieData?.results ?? []),
      ...(tvData?.results ?? []),
    ];
    const allGenres = [
      ...new Set([...(movieData?.genres ?? []), ...(tvData?.genres ?? [])]),
    ];
    return {
      entity: entities[0] ?? null,
      genres: allGenres,
      results: shuffle([...entities.slice(1), ...allResults]),
    };
  }

  const media = type === "tv_series" ? "tv" : "movie";

  const searchRes = (await tmdbFetch(
    tmdbUrl(`/search/${media}`, { query: name }),
  )) as { results?: Record<string, unknown>[] };

  const item = searchRes.results?.[0];
  if (!item) return null;

  const [detail, similar] = await Promise.all([
    tmdbFetch(tmdbUrl(`/${media}/${item.id as number}`)) as Promise<
      Record<string, unknown>
    >,
    tmdbFetch(
      tmdbUrl(`/${media}/${item.id as number}/recommendations`),
    ) as Promise<{ results?: Record<string, unknown>[] }>,
  ]);

  const genres: string[] = ((detail.genres ?? []) as { name: string }[]).map(
    (g) => g.name,
  );

  // Build the matched entity card (the movie the user searched for)
  const entityCard: MovieResult = {
    id: typeof detail.id === "number" ? detail.id : undefined,
    title: (detail.title ?? detail.name ?? "Unknown") as string,
    year: (
      (detail.release_date ?? detail.first_air_date ?? "") as string
    ).slice(0, 4),
    rating:
      typeof detail.vote_average === "number"
        ? detail.vote_average.toFixed(1)
        : "N/A",
    poster: detail.poster_path
      ? `https://image.tmdb.org/t/p/w300${detail.poster_path}`
      : null,
    genres,
    description: (detail.overview ?? "") as string,
    mediaType: type,
    episodeCount:
      type === "tv_series" && typeof detail.number_of_episodes === "number"
        ? detail.number_of_episodes
        : null,
  };

  const similarItems: MovieResult[] = (
    (similar.results ?? []) as Record<string, unknown>[]
  )
    .slice(0, RECOMMENDATION_LIMIT)
    .map((r) => formatItem(r, media));

  const results =
    media === "tv" ? await enrichTvEpisodeCounts(similarItems) : similarItems;

  return { entity: entityCard, genres, results: shuffle(results) };
}

export async function fetchByGenre(
  genreName: string,
  type: "movie" | "tv_series" | "both" = "both",
): Promise<{ genres: string[]; results: MovieResult[] } | null> {
  if (type === "both") {
    const [movieData, tvData] = await Promise.all([
      fetchByGenre(genreName, "movie"),
      fetchByGenre(genreName, "tv_series"),
    ]);
    if (!movieData && !tvData) return null;
    return {
      genres: [genreName],
      results: shuffle([
        ...(movieData?.results ?? []),
        ...(tvData?.results ?? []),
      ]),
    };
  }

  const lower = await sanitize(genreName);
  const media = type === "tv_series" ? "tv" : "movie";
  const genreMap = media === "tv" ? TV_GENRE_MAP : MOVIE_GENRE_MAP;
  const genreId = genreMap[lower];
  if (!genreId) return null;

  const res = (await tmdbFetch(
    tmdbUrl(`/discover/${media}`, {
      with_genres: String(genreId),
      sort_by: "popularity.desc",
    }),
  )) as { results?: Record<string, unknown>[] };

  const baseResults: MovieResult[] = (
    (res.results ?? []) as Record<string, unknown>[]
  )
    .slice(0, DISCOVER_LIMIT)
    .map((r: Record<string, unknown>) => formatItem(r, media));

  const results =
    media === "tv" ? await enrichTvEpisodeCounts(baseResults) : baseResults;

  return { genres: [genreName], results: shuffle(results) };
}

// ── TMDB — by multiple genres (AND logic) ─────────────────────────────────────
export async function fetchByGenres(
  genreNames: string[],
  type: "movie" | "tv_series" | "both" = "both",
): Promise<{ genres: string[]; results: MovieResult[] } | null> {
  if (type === "both") {
    const [movieData, tvData] = await Promise.all([
      fetchByGenres(genreNames, "movie"),
      fetchByGenres(genreNames, "tv_series"),
    ]);
    if (!movieData && !tvData) return null;
    return {
      genres: genreNames,
      results: shuffle([
        ...(movieData?.results ?? []),
        ...(tvData?.results ?? []),
      ]),
    };
  }

  const media = type === "tv_series" ? "tv" : "movie";
  const genreMap = media === "tv" ? TV_GENRE_MAP : MOVIE_GENRE_MAP;

  const ids: number[] = [];
  for (const name of genreNames) {
    const lower = await sanitize(name);
    const id = genreMap[lower];
    if (id) ids.push(id);
  }
  if (ids.length === 0) return null;

  // Random page 1-5 for variety
  const page = Math.floor(Math.random() * 8) + 1;

  const res = (await tmdbFetch(
    tmdbUrl(`/discover/${media}`, {
      with_genres: ids.join(","),
      sort_by: "popularity.desc",
      page: String(page),
    }),
  )) as { results?: Record<string, unknown>[] };

  const baseResults: MovieResult[] = (
    (res.results ?? []) as Record<string, unknown>[]
  )
    .slice(0, DISCOVER_LIMIT)
    .map((r: Record<string, unknown>) => formatItem(r, media));

  const results =
    media === "tv" ? await enrichTvEpisodeCounts(baseResults) : baseResults;

  return { genres: genreNames, results: shuffle(results) };
}
