"use client";

import { aiSearch } from "@/app/actions/search";
import CoverflowCarousel from "@/components/coverflow-carousel";
import MovieList from "@/components/movie-list";
import SearchBox from "@/components/search-box";
import type { MovieResult } from "@/lib/schemas";
import { normalizeSearch } from "@/lib/utils";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { readStreamableValue } from '@ai-sdk/rsc';
export default function Home() {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [aiMovies, setAiMovies] = useState<MovieResult[]>([]);
  // Client-side rate limit: store timestamps of the last N requests
  const requestTimestamps = useRef<number[]>([]);

  function addTag(raw: string) {
    const t = normalizeSearch(raw);
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((p) => p !== tag));
  }

  // Local search (TBD — placeholder)
  function handleLocalSearch(q: string) {
    console.log("[Local Search]", q);
  }

  // AI search via server action — streams movie cards as they arrive
  const handleGoogleSearch = useCallback(async (q: string) => {
    // Client-side rate limit: max 5 requests per minute
    const now = Date.now();
    requestTimestamps.current = requestTimestamps.current.filter((ts) => now - ts < 60_000);
    if (requestTimestamps.current.length >= 5) {
      return;
    }
    requestTimestamps.current.push(now);

    setIsSearching(true);
    setAiMovies([]);

    try {
      const response = await aiSearch(q, tags);
      if (!response.ok) {
        return;
      }

      if (!response.movieStream) return;
      for await (const value of readStreamableValue(response.movieStream)) {
        if (!value) continue;
        try {
          const movie = JSON.parse(value) as MovieResult;
          setAiMovies((prev) => [...prev, movie]);
        } catch { /* skip unparseable */ }
      }
    } finally {
      setIsSearching(false);
    }
  }, [tags]);

  // Auto-search when tags change
  useEffect(() => {
    if (tags.length > 0) {
      handleGoogleSearch(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-netflix-dark">
      {/* Top: Welcome section */}
      <header className="flex w-full flex-col items-center pt-12 pb-4">
        <motion.h1
          className="text-4xl font-bold tracking-tight text-white md:text-5xl"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-netflix-red">Movie</span> Finder
        </motion.h1>
        <motion.p
          className="mt-3 text-lg text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Type below to get personalized recommendations
        </motion.p>
        <motion.div
          className="mt-6 h-1 w-24 rounded-full bg-netflix-red"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        />
        
      </header>

      {/* Center: Coverflow carousel — shows AI-generated results only */}
      <motion.section
        className="w-full max-w-6xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <CoverflowCarousel movies={aiMovies} />
      </motion.section>

      {/* Bottom: Search input */}
      <section className="w-full pb-8">
        <SearchBox
          query={query}
          setQuery={setQuery}
          tags={tags}
          addTag={addTag}
          removeTag={removeTag}
          onLocalSearch={handleLocalSearch}
          onGoogleSearch={handleGoogleSearch}
          isSearching={isSearching}
        />

        {/* AI-powered TMDB results */}
        {aiMovies.length > 0 && (
          <motion.div
            className="mx-auto mt-6 w-full max-w-5xl px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="mb-4 text-xl font-bold text-white">
              Recommended{" "}
              <span className="text-sm font-normal text-white/40">({aiMovies.length})</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {aiMovies.map((m, i) => (
                <motion.div
                  key={`${m.title}-${i}`}
                  className="group overflow-hidden rounded-xl border border-white/6 bg-white/3 transition-colors hover:bg-white/8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  {m.poster ? (
                    <img
                      src={m.poster}
                      alt={m.title}
                      className="aspect-2/3 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-2/3 w-full bg-netflix-gray" />
                  )}
                  <div className="p-3">
                    <h3 className="truncate text-sm font-bold text-white group-hover:text-netflix-red transition-colors">
                      {m.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                      <span>{m.year}</span>
                      <span className="text-netflix-red">★ {m.rating}</span>
                    </div>
                    {m.genres.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.genres.slice(0, 2).map((g) => (
                          <span key={g} className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/50">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/35">
                      {m.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </section>

      {/* Movie list */}
      <motion.section
        className="w-full pb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <MovieList movies={aiMovies} />
      </motion.section>
    </div>
  );
}
