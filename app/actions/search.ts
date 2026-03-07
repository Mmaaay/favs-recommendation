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

type IdentifyEntityResult = {
  canonical_name: string;
  type: "movie" | "tv_series";
  confidence: "high" | "medium" | "low";
};

function parseIdentifyEntityOutput(rawText: string): IdentifyEntityResult {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const jsonBlock = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  const parsed = JSON.parse(jsonBlock) as Partial<IdentifyEntityResult>;

  if (!parsed.canonical_name || typeof parsed.canonical_name !== "string") {
    throw new Error("identifyEntity: missing canonical_name");
  }
  if (parsed.type !== "movie" && parsed.type !== "tv_series") {
    throw new Error("identifyEntity: invalid type");
  }
  if (
    parsed.confidence !== "high" &&
    parsed.confidence !== "medium" &&
    parsed.confidence !== "low"
  ) {
    throw new Error("identifyEntity: invalid confidence");
  }

  return {
    canonical_name: parsed.canonical_name.trim(),
    type: parsed.type,
    confidence: parsed.confidence,
  };
}

// ── AI identifies vague input via Google Search ──────────────────────────────
async function identifyEntity(userInput: string) {
  const rl = await checkLimit(identifyEntityLimiter);
  if (!rl.allowed) {
    throw new Error(`AI identify rate limited — retry in ${rl.retryAfter}s`);
  }

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: `Task: map an informal user description to ONE best-known movie or TV series.

Hard rules:
- Return EXACTLY one JSON object and nothing else.
- No markdown, no code fences, no prose, no explanation.
- Keys must be exactly: canonical_name, type, confidence.
- type must be exactly "movie" or "tv_series".
- confidence must be exactly "high", "medium", or "low".
- canonical_name must be the most recognized English title.
- If uncertain, still provide the single best guess with lower confidence.

The user is trying to find a movie or TV show using an informal, cryptic, or slang description. Do NOT interpret words literally. Infer the most likely title from plot, characters, themes, or cultural references.

User description: "${userInput}"

Use Google Search if needed.
Output format:
{ "canonical_name": "...", "type": "movie" | "tv_series", "confidence": "high" | "medium" | "low" }`,
    tools: { google_search: google.tools.googleSearch({}) },
    maxOutputTokens: 300,
  });

  return parseIdentifyEntityOutput(text);
}

// ── Main server action ────────────────────────────────────────────────────────
const MAX_QUERY_LENGTH = 50;

export async function aiSearch(
  query: string,
  tags: string[] = [],
  contentType: "movie" | "tv_series" | "both" = "both",
) {
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false as const, error: "Query is too long." };
  }
  const trimmed = await sanitize(query);
  if (!trimmed && tags.length === 0) {
    return { ok: false as const, error: "Query cannot be empty." };
  }

  // Upstash rate limit check
  const rl = await checkLimit(aiSearchLimiter);
  if (!rl.allowed) {
    return {
      ok: false as const,
      error: `Rate limited — retry in ${rl.retryAfter}s`,
    };
  }

  // Pre-resolve entity for vague queries before starting the stream
  let entityName: string | null = null;
  let resolvedName: string | null = null;
  let resolvedMediaType: "movie" | "tv_series" = "movie";
  let inputClass: "genre" | "exact_name" | "vague" | null = null;

  // Any non-empty query takes precedence over tags.
  if (trimmed) {
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

      if (trimmed) {
        if (inputClass === "genre") {
          const data = await fetchByGenre(trimmed, contentType);
          if (data) {
            movies = data.results;
          }
        } else if (inputClass === "exact_name") {
          const data = await fetchByName(trimmed, contentType);
          if (data) {
            movies = data.entity
              ? [data.entity, ...data.results]
              : data.results;
          }
        } else if (inputClass === "vague" && resolvedName) {
          const selectedType =
            contentType === "both" ? resolvedMediaType : contentType;
          const data = await fetchByName(resolvedName, selectedType);
          if (data) {
            movies = data.entity
              ? [data.entity, ...data.results]
              : data.results;
          }
        }
      } else if (tags.length > 0) {
        const genreTags = tags.filter((t) => isKnownGenre(t));
        if (genreTags.length > 0) {
          const data = await fetchByGenres(genreTags, contentType);
          if (data) movies = data.results;
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
