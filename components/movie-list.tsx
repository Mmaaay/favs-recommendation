"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { Movie } from "@/lib/movies";

type ListMovie = Pick<Movie, "title" | "year" | "rating" | "genres" | "description"> & {
  id?: number;
  poster?: string | null;
};

export default function MovieList({ movies }: { movies: ListMovie[] }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <motion.h2
        className="mb-4 text-xl font-bold text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        All Results{" "}
        <span className="text-sm font-normal text-white/40">
          ({movies.length})
        </span>
      </motion.h2>

      <div className="rounded-2xl border border-white/6 bg-linear-to-b from-netflix-gray/80 to-netflix-dark/90 shadow-[0_0_50px_rgba(229,9,20,0.08)] backdrop-blur-md">
        <AnimatePresence mode="popLayout">
          {movies.length === 0 && (
            <motion.p
              key="empty"
              className="py-12 text-center text-sm text-white/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              No movies match your filters.
            </motion.p>
          )}

          {movies.map((movie, i) => (
            <MovieRow key={movie.id ?? `row-${i}`} movie={movie} index={i} isLast={i === movies.length - 1} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const MovieRow = memo(function MovieRow({
  movie,
  index,
  isLast,
}: {
  movie: ListMovie;
  index: number;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className={`group flex gap-4 p-4 transition-colors hover:bg-white/3 ${
        !isLast ? "border-b border-white/6" : ""
      }`}
    >
      {/* Poster thumbnail */}
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg shadow-md shadow-black/40">
        {movie.poster ? (
          <Image
            src={movie.poster}
            alt={movie.title}
            fill
            sizes="80px"
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-netflix-gray" />
        )}
        {/* Rating badge */}
        <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
          <span className="text-[10px] font-bold text-netflix-red">★</span>
          <span className="text-[10px] font-semibold text-white">{movie.rating}</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-white group-hover:text-netflix-red transition-colors duration-200">
            {movie.title}
          </h3>
          <span className="shrink-0 text-xs text-white/30">{movie.year}</span>
        </div>

        {/* Genre pills */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {movie.genres.map((g) => (
            <span
              key={g}
              className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-white/60"
            >
              {g}
            </span>
          ))}
        </div>

        {/* Description */}
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/40 group-hover:text-white/55 transition-colors duration-200">
          {movie.description}
        </p>
      </div>
    </motion.div>
  );
});
