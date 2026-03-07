"use client";

import { aiSearch } from "@/app/actions/search";
import { musicSearch } from "@/app/actions/music-search";
import CoverflowCarousel from "@/components/coverflow-carousel";
import MovieList from "@/components/movie-list";
import MusicList from "@/components/music-list";
import SearchBox from "@/components/search-box";
import type { MovieResult, MusicResult } from "@/lib/schemas";
import { normalizeSearch } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Music } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readStreamableValue } from "@ai-sdk/rsc";

type Tab = "movies" | "music";
type TaggedMusic = MusicResult & { type?: "entity" | "similar" };
type ContentTypeFilter = "both" | "movie" | "tv_series";
type DurationFilter = "any" | "short" | "medium" | "long";

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function matchesDurationFilter(movie: MovieResult, filter: DurationFilter): boolean {
  if (filter === "any") return true;
  if (movie.mediaType !== "tv_series") return true;
  const episodes = movie.episodeCount;
  if (typeof episodes !== "number") return true;

  if (filter === "short") return episodes <= 16;
  if (filter === "medium") return episodes >= 17 && episodes <= 60;
  return episodes > 60;
}

export default function Home() {
  const SEARCH_DEBOUNCE_MS = 220;
  const SEARCH_SPAM_GUARD_MS = 700;

  const [activeTab, setActiveTab] = useState<Tab>("movies");

  // ── Movie state ─────────────────────────────────────────────────────────────
  const [movieQuery, setMovieQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isMovieSearching, setIsMovieSearching] = useState(false);
  const [aiMovies, setAiMovies] = useState<MovieResult[]>([]);
  const [contentType, setContentType] = useState<ContentTypeFilter>("both");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("any");
  const skipAutoSearch = useRef(false);
  const movieSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMovieSearchAtRef = useRef(0);

  // ── Music state ─────────────────────────────────────────────────────────────
  const [musicQuery, setMusicQuery] = useState("");
  const [isMusicSearching, setIsMusicSearching] = useState(false);
  const [musicResults, setMusicResults] = useState<TaggedMusic[]>([]);

  // ── Movie helpers ───────────────────────────────────────────────────────────
  const addTag = useCallback((raw: string) => {
    const t = normalizeSearch(raw);
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((p) => p !== tag));
  }, []);

  function handleLocalSearch(q: string) {
    console.log("[Local Search]", q);
  }

  const runMovieSearch = useCallback(
    async (q: string, incomingTags: string[]) => {
      const hasTypedQuery = q.trim().length > 0;
      const effectiveTags = hasTypedQuery ? [] : incomingTags;

      // Typed input should override genre tag filtering for this request.
      if (hasTypedQuery && incomingTags.length > 0) {
        setTags([]);
      }

      setIsMovieSearching(true);
      setAiMovies([]);

      try {
        const response = await aiSearch(q, effectiveTags, contentType);
        if (!response.ok) return;

        if (response.entityName) {
          skipAutoSearch.current = true;
          addTag(response.entityName);
          setMovieQuery("");
        }

        if (!response.movieStream) return;
        for await (const value of readStreamableValue(response.movieStream)) {
          if (!value) continue;
          try {
            const movie = JSON.parse(value) as MovieResult;
            setAiMovies((prev) => [...prev, movie]);
          } catch {
            /* skip unparseable */
          }
        }
      } finally {
        setIsMovieSearching(false);
      }
    },
    [addTag, contentType],
  );

  const handleGoogleSearch = useCallback(
    (q: string) => {
      if (movieSearchDebounceRef.current) {
        clearTimeout(movieSearchDebounceRef.current);
      }

      movieSearchDebounceRef.current = setTimeout(() => {
        const now = Date.now();
        if (now - lastMovieSearchAtRef.current < SEARCH_SPAM_GUARD_MS) {
          return;
        }

        lastMovieSearchAtRef.current = now;
        void runMovieSearch(q, tags);
      }, SEARCH_DEBOUNCE_MS);
    },
    [runMovieSearch, tags],
  );

  useEffect(() => {
    return () => {
      if (movieSearchDebounceRef.current) {
        clearTimeout(movieSearchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (skipAutoSearch.current) {
      skipAutoSearch.current = false;
      return;
    }
    if (tags.length > 0) {
      handleGoogleSearch(movieQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  useEffect(() => {
    if (!movieQuery.trim() && tags.length === 0) return;
    handleGoogleSearch(movieQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  // ── Music handler ───────────────────────────────────────────────────────────
  const handleMusicSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setIsMusicSearching(true);
    setMusicResults([]);

    try {
      const response = await musicSearch(q);
      if (!response.ok) return;

      if (!response.musicStream) return;
      for await (const value of readStreamableValue(response.musicStream)) {
        if (!value) continue;
        try {
          const parsed = JSON.parse(value) as {
            type: "entity" | "similar";
            data: MusicResult;
          };
          setMusicResults((prev) => [
            ...prev,
            { ...parsed.data, type: parsed.type },
          ]);
        } catch {
          /* skip */
        }
      }
    } finally {
      setIsMusicSearching(false);
    }
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isMovies = activeTab === "movies";
  const filteredMovies = useMemo(
    () => aiMovies.filter((movie) => matchesDurationFilter(movie, durationFilter)),
    [aiMovies, durationFilter],
  );
  const carouselMovies = useMemo(
    () => shuffleArray(filteredMovies).slice(0, 10),
    [filteredMovies],
  );
  const tabTitles: Record<Tab, { accent: string; rest: string; subtitle: string }> = {
    movies: {
      accent: "Movie",
      rest: " Finder",
      subtitle: "Type below to get personalized recommendations",
    },
    music: {
      accent: "Music",
      rest: " Finder",
      subtitle: "Search for a song to discover similar tracks",
    },
  };

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
          <span className="text-netflix-red">{tabTitles[activeTab].accent}</span>
          {tabTitles[activeTab].rest}
        </motion.h1>
        <motion.p
          className="mt-3 text-lg text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {tabTitles[activeTab].subtitle}
        </motion.p>
        <motion.div
          className="mt-6 h-1 w-24 rounded-full bg-netflix-red"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        />

        {/* Tab switcher */}
        <div className="mt-6 flex items-center gap-1 rounded-xl border border-white/10 bg-white/3 p-1">
          <button
            onClick={() => setActiveTab("movies")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
              isMovies
                ? "bg-netflix-red text-white shadow-lg shadow-netflix-red/25"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <Film className="h-4 w-4" />
            Movies / Series
          </button>
          <button
            onClick={() => setActiveTab("music")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
              !isMovies
                ? "bg-netflix-red text-white shadow-lg shadow-netflix-red/25"
                : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <Music className="h-4 w-4" />
            Music
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isMovies ? (
          <motion.div
            key="movies"
            className="flex w-full flex-col items-center"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Coverflow carousel */}
            <motion.section
              className="w-full max-w-6xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <CoverflowCarousel movies={carouselMovies} />
            </motion.section>

            {/* Search input */}
            <section className="w-full pb-8">
              <SearchBox
                query={movieQuery}
                setQuery={setMovieQuery}
                tags={tags}
                addTag={addTag}
                removeTag={removeTag}
                onLocalSearch={handleLocalSearch}
                onGoogleSearch={handleGoogleSearch}
                isSearching={isMovieSearching}
                contentType={contentType}
                setContentType={setContentType}
                durationFilter={durationFilter}
                setDurationFilter={setDurationFilter}
              />

              {/* Grid cards */}
              {filteredMovies.length > 0 && (
                <motion.div
                  className="mx-auto mt-6 w-full max-w-5xl px-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="mb-4 text-xl font-bold text-white">
                    Recommended{" "}
                    <span className="text-xs font-bold text-red-400">
                      Work In Progress
                    </span>{" "}
                    <span className="text-sm font-normal text-white/40">
                      ({filteredMovies.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {filteredMovies.map((m, i) => (
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
                          <h3 className="truncate text-sm font-bold text-white transition-colors group-hover:text-netflix-red">
                            {m.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                            <span>{m.year}</span>
                            <span className="text-netflix-red">★ {m.rating}</span>
                          </div>
                          {m.genres.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {m.genres.slice(0, 2).map((g) => (
                                <span
                                  key={g}
                                  className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/50"
                                >
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
              <MovieList movies={filteredMovies} />
            </motion.section>
          </motion.div>
        ) : (
          <motion.div
            key="music"
            className="flex w-full flex-col items-center"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Music search */}
            <section className="w-full pb-8">
              <MusicSearchBox
                query={musicQuery}
                setQuery={setMusicQuery}
                onSearch={handleMusicSearch}
                isSearching={isMusicSearching}
              />
            </section>

            {/* Music results */}
            <motion.section
              className="w-full pb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <MusicList tracks={musicResults} />
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Inline music search box (keeps it simple, no separate file needed) ────────
function MusicSearchBox({
  query,
  setQuery,
  onSearch,
  isSearching,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  isSearching: boolean;
}) {
  const isFocused = query.length > 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = query.trim();
      if (!v) return;
      onSearch(v);
    }
  }

  return (
    <motion.div
      className="mx-auto w-full max-w-2xl px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      <div
        className={`relative flex items-center rounded-xl border transition-all duration-300 ${
          isFocused
            ? "border-netflix-red/60 bg-white/5 shadow-[0_0_20px_rgba(229,9,20,0.15)]"
            : "border-white/10 bg-white/3 hover:border-white/20"
        }`}
      >
        <Music
          className={`ml-4 h-5 w-5 transition-colors duration-300 ${
            isFocused ? "text-netflix-red" : "text-white/40"
          }`}
        />
        <input
          type="text"
          placeholder='Search a song, e.g. "Living on a Prayer"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-14 flex-1 border-0 bg-transparent px-3 text-base text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>

      {query.length > 0 && (
        <motion.div
          className="mt-3 flex justify-center"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            onClick={() => !isSearching && onSearch(query)}
            disabled={isSearching}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white transition-colors ${
              isSearching
                ? "cursor-wait bg-netflix-red/60"
                : "bg-netflix-red/90 hover:bg-netflix-red"
            }`}
          >
            <Music className="h-3.5 w-3.5" />
            {isSearching ? "Searching…" : "Find Similar"}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
