import { z } from "zod/v4";

export const MovieResultSchema = z.object({
  title: z.string(),
  year: z.string(),
  rating: z.string(),
  poster: z.string().nullable(),
  genres: z.array(z.string()),
  description: z.string(),
});

export const AiSearchResultSchema = z.object({
  movies: z.array(MovieResultSchema).max(10),
});

export type MovieResult = z.infer<typeof MovieResultSchema>;
export type AiSearchResult = z.infer<typeof AiSearchResultSchema>;

export const IdentifiedEntitySchema = z.object({
  canonical_name: z
    .string()
    .min(1)
    .describe("Best-known canonical title for the matched movie or TV series."),
  type: z
    .enum(["movie", "tv_series"])
    .describe("Use 'movie' for films or 'tv_series' for episodic shows."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence that the user description maps to the canonical title."),
}).describe(
  "Map a vague user description to one canonical movie or TV series entity.",
);

export type IdentifiedEntity = z.infer<typeof IdentifiedEntitySchema>;

// ── Music types ───────────────────────────────────────────────────────────────
export const MusicResultSchema = z.object({
  name: z.string(),
  artist: z.string(),
  url: z.string().nullable(),
  playcount: z.number().optional(),
  tags: z.array(z.string()),
});

export type MusicResult = z.infer<typeof MusicResultSchema>;
