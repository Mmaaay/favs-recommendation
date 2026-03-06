"use server";

import type { MovieResult } from "@/lib/schemas";

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
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
};

const TV_GENRE_BY_ID: Record<number, string> = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics", 37: "Western",
};

// ── Input classification ──────────────────────────────────────────────────────
const KNOWN_GENRES = [
  "action", "comedy", "drama", "horror", "romance", "thriller",
  "sci-fi", "fantasy", "animation", "crime", "documentary", "mystery",
  "adventure", "family", "history", "music", "war", "western",
];

export type InputClass = "genre" | "exact_name" | "vague";

export async function classifyInput(input: string): Promise<InputClass> {
  const lower = await sanitize(input);
  if (KNOWN_GENRES.some((g) => lower.includes(g))) return "genre";
  const fillers = ["that", "the", "about", "with", "where", "show", "movie", "film"];
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
const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  const key = process.env.TMDB_API_KEY ?? "";
  const sp = new URLSearchParams({ api_key: key, language: "en-US", ...params });
  return `${TMDB_BASE}${path}?${sp.toString()}`;
}

function formatItem(r: Record<string, unknown>, mediaType: "movie" | "tv" = "movie"): MovieResult {
  const title = (r.title ?? r.name ?? "Unknown") as string;
  const year = ((r.release_date ?? r.first_air_date ?? "") as string).slice(0, 4);
  const rating = typeof r.vote_average === "number" ? r.vote_average.toFixed(1) : "N/A";
  const posterPath = r.poster_path as string | null;
  const overview = (r.overview ?? "") as string;
  const genreIds = (r.genre_ids ?? []) as number[];
  const genreMap = mediaType === "tv" ? TV_GENRE_BY_ID : MOVIE_GENRE_BY_ID;
  const genres = genreIds.map((id) => genreMap[id]).filter(Boolean);

  return {
    title,
    year,
    rating,
    poster: posterPath ? `https://image.tmdb.org/t/p/w300${posterPath}` : null,
    genres,
    description: overview,
  };
}

export async function fetchByName(
  name: string,
  type: "movie" | "tv_series" = "movie",
): Promise<{ genres: string[]; results: MovieResult[] } | null> {
  const media = type === "tv_series" ? "tv" : "movie";

  const searchRes = await fetch(
    tmdbUrl(`/search/${media}`, { query: name }),
  ).then((r) => r.json());

  const item = searchRes.results?.[0];
  if (!item) return null;

  const [detail, similar] = await Promise.all([
    fetch(tmdbUrl(`/${media}/${item.id}`)).then((r) => r.json()),
    fetch(tmdbUrl(`/${media}/${item.id}/similar`)).then((r) => r.json()),
  ]);

  const genres: string[] = detail.genres?.map((g: { name: string }) => g.name) ?? [];

  const results: MovieResult[] = (similar.results ?? [])
    .slice(0, 10)
    .map((r: Record<string, unknown>) => formatItem(r, media));

  return { genres, results: shuffle(results) };
}

export async function fetchByGenre(
  genreName: string,
  type: "movie" | "tv_series" = "movie",
): Promise<{ genres: string[]; results: MovieResult[] } | null> {
  const lower = await sanitize(genreName);
  const media = type === "tv_series" ? "tv" : "movie";
  const genreMap = media === "tv" ? TV_GENRE_MAP : MOVIE_GENRE_MAP;
  const genreId = genreMap[lower];
  if (!genreId) return null;

  const res = await fetch(
    tmdbUrl(`/discover/${media}`, {
      with_genres: String(genreId),
      sort_by: "popularity.desc",
    }),
  ).then((r) => r.json());

  const results: MovieResult[] = (res.results ?? [])
    .slice(0, 10)
    .map((r: Record<string, unknown>) => formatItem(r, media));

  return { genres: [genreName], results: shuffle(results) };
}

// ── TMDB — by multiple genres (AND logic) ─────────────────────────────────────
export async function fetchByGenres(
  genreNames: string[],
  type: "movie" | "tv_series" = "movie",
): Promise<{ genres: string[]; results: MovieResult[] } | null> {
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
  const page = Math.floor(Math.random() * 5) + 1;

  const res = await fetch(
    tmdbUrl(`/discover/${media}`, {
      with_genres: ids.join(","),
      sort_by: "popularity.desc",
      page: String(page),
    }),
  ).then((r) => r.json());

  const results: MovieResult[] = (res.results ?? [])
    .slice(0, 10)
    .map((r: Record<string, unknown>) => formatItem(r, media));

  return { genres: genreNames, results: shuffle(results) };
}
