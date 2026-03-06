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
