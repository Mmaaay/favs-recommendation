"use client";

import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchBox({
  query,
  setQuery,
  tags,
  addTag,
  removeTag,
  onLocalSearch,
  onGoogleSearch,
  isSearching,
}: {
  query: string;
  setQuery: (q: string) => void;
  tags: string[];
  addTag: (t: string) => void;
  removeTag: (t: string) => void;
  onLocalSearch: (q: string) => void;
  onGoogleSearch: (q: string) => void;
  isSearching: boolean;
}) {
  const isFocused = query.length > 0 || tags.length > 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = query.trim();
      if (!v) return;
      onGoogleSearch(v);
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
        <Search
          className={`ml-4 h-5 w-5 transition-colors duration-300 ${
            isFocused ? "text-netflix-red" : "text-white/40"
          }`}
        />
        <Input
          type="text"
          placeholder="Describe a movie, genre, mood, or anything..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-14 border-0 bg-transparent text-base text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:border-0 shadow-none"
        />
      </div>

      {/* Search buttons — show when typing or tags exist */}
      {(query.length > 0 || tags.length > 0) && (
        <motion.div
          className="mt-3 flex justify-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            onClick={() => onLocalSearch(query)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-white/8 px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
          <button
            onClick={() => !isSearching && onGoogleSearch(query)}
            disabled={isSearching}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white transition-colors ${
              isSearching
                ? "bg-netflix-red/60 cursor-wait"
                : "bg-netflix-red/90 hover:bg-netflix-red"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isSearching ? "Searching" : "AI Search"}
          </button>
        </motion.div>
      )}

      {/* Selected tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => removeTag(t)}
              className="flex items-center gap-1 rounded-full border border-netflix-red/60 bg-netflix-red/10 px-3.5 py-1.5 text-xs text-white/90 transition-all hover:bg-netflix-red/20"
              title="Remove tag"
            >
              <span className="capitalize">{t}</span>
              <span className="text-sm">✕</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
