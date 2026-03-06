"use server";

import { google } from "@ai-sdk/google";
import { createStreamableValue } from "@ai-sdk/rsc";
import { generateText } from "ai";
import {
  classifyInput,
  sanitize,
  fetchByName,
  fetchByGenre,
  fetchByGenres,
  isKnownGenre,
} from "@/lib/tmdb";
import type { MovieResult } from "@/lib/schemas";
import {
  aiSearchLimiter,
  identifyEntityLimiter,
  checkLimit,
} from "@/lib/rate-limit";

// ── AI identifies vague input via Google Search ──────────────────────────────
async function identifyEntity(userInput: string) {
  const rl = await checkLimit(identifyEntityLimiter);
  if (!rl.allowed) {
    throw new Error(`AI identify rate limited — retry in ${rl.retryAfter}s`);
  }

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: `The user typed: "${userInput}"
Identify the movie or TV show they mean.
Respond ONLY with valid JSON, no markdown:
{ "canonical_name": "...", "type": "movie" | "tv_series", "confidence": "high" | "medium" | "low" }`,
    tools: { google_search: google.tools.googleSearch({}) },
    maxOutputTokens: 200,
  });

  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as {
    canonical_name: string;
    type: "movie" | "tv_series";
    confidence: string;
  };
}

// ── Main server action ────────────────────────────────────────────────────────
export async function aiSearch(query: string, tags: string[] = []) {
  const trimmed = await sanitize(query);
  if (!trimmed && tags.length === 0) {
    return { ok: false as const, error: "Query cannot be empty." };
  }

  // Upstash rate limit check
  const rl = await checkLimit(aiSearchLimiter);
  if (!rl.allowed) {
    return { ok: false as const, error: `Rate limited — retry in ${rl.retryAfter}s` };
  }

  // Pre-resolve entity for vague queries before starting the stream
  let entityName: string | null = null;
  let resolvedName: string | null = null;
  let resolvedMediaType: "movie" | "tv_series" = "movie";
  let inputClass: "genre" | "exact_name" | "vague" | null = null;

  if (tags.length === 0 && trimmed) {
    inputClass = await classifyInput(trimmed);
    if (inputClass === "vague") {
      const entity = await identifyEntity(trimmed);
      resolvedName = await sanitize(entity.canonical_name);
      resolvedMediaType = entity.type;
      entityName = entity.canonical_name;
    }
  }

  const movieStream = createStreamableValue<string>("");

  (async () => {
    try {
      let movies: MovieResult[] = [];

      if (tags.length > 0) {
        // Split tags into genre tags and entity-name tags
        const genreTags = tags.filter((t) => isKnownGenre(t));
        const nameTags = tags.filter((t) => !isKnownGenre(t));

        // Fetch similar movies for entity-name tags
        for (const name of nameTags) {
          const data = await fetchByName(name);
          if (data) {
            movies.push(...(data.entity ? [data.entity, ...data.results] : data.results));
          }
        }

        // Fetch by genre combination
        if (genreTags.length > 0) {
          const data = await fetchByGenres(genreTags);
          if (data) {
            movies.push(...data.results);
          }
        }
      } else if (trimmed) {
        if (inputClass === "genre") {
          const data = await fetchByGenre(trimmed);
          if (data) {
            movies = data.results;
          }
        } else if (inputClass === "exact_name") {
          const data = await fetchByName(trimmed);
          if (data) {
            movies = data.entity ? [data.entity, ...data.results] : data.results;
          }
        } else if (inputClass === "vague" && resolvedName) {
          const data = await fetchByName(resolvedName, resolvedMediaType);
          if (data) {
            movies = data.entity ? [data.entity, ...data.results] : data.results;
          }
        }
      }

      // Stream movies one by one
      for (const movie of movies) {
        movieStream.update(JSON.stringify(movie));
        await new Promise((r) => setTimeout(r, 100));
      }
      movieStream.done();
    } catch {
      movieStream.done();
    }
  })();

  return {
    ok: true as const,
    query: trimmed,
    entityName,
    movieStream: movieStream.value,
  };
}
