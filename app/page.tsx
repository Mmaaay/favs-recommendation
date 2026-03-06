"use client";

import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import CoverflowCarousel from "@/components/coverflow-carousel";
import MovieList from "@/components/movie-list";
import SearchBox from "@/components/search-box";
import { MOVIES } from "@/lib/movies";
import { normalizeSearch, tokenizeSearch } from "@/lib/utils";
import { aiSearch } from "@/app/actions/search";

export default function Home() {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);

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

  // AI search via server action (throttled server-side)
  const handleGoogleSearch = useCallback(async (q: string) => {
    const result = await aiSearch(q);
    if (!result.ok) {
      console.log("[AI Search]", result.error);
    } else {
      console.log("[AI Search] result:", result);
    }
  }, []);

  const filtered = useMemo(() => {
    const normQuery = normalizeSearch(query);
    const tokens = tokenizeSearch(query);

    // start from MOVIES, but first apply tag filters if any
    let candidates = MOVIES;
    if (tags.length > 0) {
      candidates = candidates.filter((m) => {
        const normGenres = m.genres.map((g) => normalizeSearch(g));
        // require every selected tag to appear in genres
        return tags.every((t) => normGenres.some((g) => g.includes(t)));
      });
    }

    // if no query, return candidates
    if (!normQuery) return candidates;

    // otherwise filter candidates by query (title/genre/year)
    return candidates.filter((m) => {
      const normTitle = normalizeSearch(m.title);
      const normGenres = m.genres.map((g) => normalizeSearch(g));
      const year = m.year;

      if (
        normTitle.includes(normQuery) ||
        normGenres.some((g) => g.includes(normQuery)) ||
        year.includes(normQuery)
      ) {
        return true;
      }

      if (tokens.length > 0) {
        return tokens.every((token) => {
          const n = normalizeSearch(token);
          return (
            normTitle.includes(n) ||
            year.includes(n) ||
            normGenres.some((g) => g.includes(n))
          );
        });
      }

      return false;
    });
  }, [query, tags]);

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
      </header>

      {/* Center: Coverflow carousel */}
      <motion.section
        className="w-full max-w-6xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <CoverflowCarousel movies={filtered} />
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
        />
      </section>

      {/* Movie list */}
      <motion.section
        className="w-full pb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <MovieList movies={filtered} />
      </motion.section>
    </div>
  );
}
