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
Identify the song and artist they mean.
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

// ── Main music server action ──────────────────────────────────────────────────
export async function musicSearch(query: string) {
  const trimmed = query.toLowerCase().trim();
  if (!trimmed) {
    return { ok: false as const, error: "Query cannot be empty." };
  }

  // Rate limit (shared Redis)
  const rl = await checkLimit(musicSearchLimiter);
  if (!rl.allowed) {
    return { ok: false as const, error: `Rate limited — retry in ${rl.retryAfter}s` };
  }

  // Step 1: Try direct Last.fm search first
  let matchedTrack = await searchTrack(trimmed);
  let entityName: string | null = null;

  // Step 2: If direct search fails or the query seems vague, use AI + Google
  if (!matchedTrack) {
    try {
      const identified = await identifySong(trimmed);
      if (identified.track && identified.artist) {
        entityName = `${identified.track} — ${identified.artist}`;
        matchedTrack = await searchTrack(
          `${identified.artist} ${identified.track}`,
        );
        // If still no match, create a synthetic entity
        if (!matchedTrack) {
          matchedTrack = {
            name: identified.track,
            artist: identified.artist,
            url: null,
            tags: [],
          };
        }
      }
    } catch {
      // AI fallback failed — return empty
    }
  }

  if (!matchedTrack) {
    return { ok: false as const, error: "Could not find that track." };
  }

  const musicStream = createStreamableValue<string>("");

  (async () => {
    try {
      const { entity, similar, artistPicks } = await getRecommendations(
        matchedTrack!.artist,
        matchedTrack!.name,
      );

      // Stream the matched entity first
      const entityCard: MusicResult = entity ?? matchedTrack!;
      musicStream.update(JSON.stringify({ type: "entity", data: entityCard }));
      await new Promise((r) => setTimeout(r, 80));

      // Stream similar tracks
      for (const track of similar) {
        musicStream.update(
          JSON.stringify({ type: "similar", data: track }),
        );
        await new Promise((r) => setTimeout(r, 80));
      }

      // Stream artist-based picks
      for (const track of artistPicks) {
        musicStream.update(
          JSON.stringify({ type: "artist_pick", data: track }),
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
