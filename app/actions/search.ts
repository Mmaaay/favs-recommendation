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
} from "@/lib/tmdb";
import type { MovieResult } from "@/lib/schemas";

// ── Throttle state (per serverless instance) ──────────────────────────────────
let lastCallTs = 0;
let isRunning = false;
const THROTTLE_MS = 2000;

// ── Step 2: AI identifies vague / exact-name input via Google Search ─────────
async function identifyEntity(userInput: string) {
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

  const now = Date.now();

  if (isRunning) {
    return { ok: false as const, error: "Search is already in progress. Please wait." };
  }

  if (now - lastCallTs < THROTTLE_MS) {
    const retryIn = Math.ceil((THROTTLE_MS - (now - lastCallTs)) / 1000);
    return { ok: false as const, error: `Throttled — try again in ${retryIn}s` };
  }

  isRunning = true;
  lastCallTs = now;

  const movieStream = createStreamableValue<string>("");

  (async () => {
    try {
      let movies: MovieResult[] = [];

      // Tags take priority: if tags are present, use multi-genre fetch
      if (tags.length > 0) {
        const data = await fetchByGenres(tags);
        if (data) {
          movies = data.results;
        }
      } else {
        const inputClass = await classifyInput(trimmed);

        if (inputClass === "genre") {
          const data = await fetchByGenre(trimmed);
          if (data) {
            movies = data.results;
          }
        } else {
          let name = trimmed;
          let mediaType: "movie" | "tv_series" = "movie";

          if (inputClass === "vague") {
            const entity = await identifyEntity(trimmed);
            name = await sanitize(entity.canonical_name);
            mediaType = entity.type;
          }

          const data = await fetchByName(name, mediaType);
          if (data) {
            movies = data.results;
          }
        }
      }

      // Stream movies one by one so cards appear progressively
      for (const movie of movies) {
        movieStream.update(JSON.stringify(movie));
        await new Promise((r) => setTimeout(r, 100));
      }
      movieStream.done();
    } catch {
      movieStream.done();
    } finally {
      isRunning = false;
    }
  })();

  return {
    ok: true as const,
    query: trimmed,
    movieStream: movieStream.value,
  };
}
