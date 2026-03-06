"use client";

import { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  MotionValue,
  type PanInfo,
} from "framer-motion";
import type { Movie } from "@/lib/movies";

const CARD_WIDTH = 280;
const CARD_GAP = -80; // stronger overlap for cramped look
const CARD_STEP = CARD_WIDTH + CARD_GAP;

// Generate a gradient poster based on movie id
function getGradient(id: number): string {
  const gradients = [
    "linear-gradient(135deg, #e50914 0%, #831010 50%, #1a1a2e 100%)",
    "linear-gradient(135deg, #b20710 0%, #3d0c11 50%, #0f0f23 100%)",
    "linear-gradient(135deg, #e50914 0%, #4a1942 50%, #1a1a2e 100%)",
    "linear-gradient(135deg, #831010 0%, #2d1f3d 50%, #141414 100%)",
    "linear-gradient(135deg, #ff4444 0%, #e50914 50%, #2a0a0a 100%)",
    "linear-gradient(135deg, #c2185b 0%, #880e4f 50%, #1a1a2e 100%)",
    "linear-gradient(135deg, #e50914 0%, #6a1b3d 50%, #1f1f3a 100%)",
    "linear-gradient(135deg, #d32f2f 0%, #b71c1c 50%, #1a0a2e 100%)",
    "linear-gradient(135deg, #e50914 0%, #5c1a1a 50%, #0d0d1a 100%)",
    "linear-gradient(135deg, #ff1744 0%, #d50000 50%, #1a1a2e 100%)",
    "linear-gradient(135deg, #e50914 0%, #4a0e0e 50%, #141414 100%)",
  ];
  return gradients[(id - 1) % gradients.length];
}

export default function CoverflowCarousel({ movies }: { movies: Movie[] }) {
  const [activeIndex, setActiveIndex] = useState(Math.floor(movies.length / 2));
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const dragStartX = useRef(0);

  const totalWidth = Math.max(0, (movies.length - 1) * CARD_STEP);

  // Reset active index when movie list changes
  useEffect(() => {
    setActiveIndex(Math.floor(movies.length / 2));
  }, [movies.length]);

  // Center the active card
  useEffect(() => {
    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    const target = -activeIndex * CARD_STEP + containerWidth / 2 - CARD_WIDTH / 2;
    animate(x, target, { type: "spring", stiffness: 300, damping: 30 });
  }, [activeIndex, x]);

  function handleDragStart() {
    dragStartX.current = x.get();
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    let newIndex = activeIndex;
    if (Math.abs(offset) > 50 || Math.abs(velocity) > 300) {
      if (offset < 0 || velocity < -300) {
        newIndex = Math.min(activeIndex + 1, movies.length - 1);
      } else {
        newIndex = Math.max(activeIndex - 1, 0);
      }
    }
    setActiveIndex(newIndex);
  }

  function handleCardClick(index: number) {
    setActiveIndex(index);
  }

  // visible window: max 5 (center + 2 each side)
  const VISIBLE_RADIUS = 2;
  const startIndex = Math.max(0, activeIndex - VISIBLE_RADIUS);
  const endIndex = Math.min(movies.length, activeIndex + VISIBLE_RADIUS + 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <div className="rounded-2xl border border-white/6 bg-linear-to-b from-netflix-gray/80 to-netflix-dark/90 p-6 shadow-[0_0_50px_rgba(229,9,20,0.12),0_0_100px_rgba(229,9,20,0.06)] backdrop-blur-md">
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden"
          style={{ height: 420 }}
        >
          <motion.div
            className="flex cursor-grab items-center active:cursor-grabbing"
            style={{ x, height: "100%" }}
            drag="x"
            dragConstraints={{ left: -totalWidth, right: totalWidth }}
            dragElastic={0.1}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
                {movies.map((movie, index) => {
                  const isVisible = index >= startIndex && index < endIndex;
                  return (
                    <CoverflowCard
                      key={movie.id}
                      movie={movie}
                      index={index}
                      activeIndex={activeIndex}
                      motionX={x}
                      containerRef={containerRef}
                      onClick={() => handleCardClick(index)}
                      isVisible={isVisible}
                    />
                  );
                })}
          </motion.div>
        </div>

        {/* Navigation dots */}
        <div className="mt-4 flex justify-center gap-1.5">
          {movies.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === activeIndex
                  ? "w-6 bg-netflix-red"
                  : "w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CoverflowCardProps {
  movie: Movie;
  index: number;
  activeIndex: number;
  motionX: MotionValue<number>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
  isVisible?: boolean;
}

function CoverflowCard({
  movie,
  index,
  activeIndex,
  motionX,
  containerRef,
  onClick,
  isVisible = true,
}: CoverflowCardProps) {
  const containerWidth = containerRef.current?.offsetWidth ?? 800;

  // Calculate the card's center position relative to the viewport center
  const cardCenter: MotionValue<number> = useTransform(motionX, (latestX: number) => {
    const cardPos = index * CARD_STEP + CARD_WIDTH / 2;
    return cardPos + latestX - containerWidth / 2;
  });

  // Distance from center determines the transforms
  const distance: MotionValue<number> = useTransform(cardCenter, (center: number) =>
    Math.abs(center) / CARD_STEP
  );

  const rotateY: MotionValue<number> = useTransform(cardCenter, (center: number) => {
    const maxRotation = 40;
    const normalizedDistance = Math.min(Math.abs(center) / (CARD_STEP * 1.5), 1);
    return center < 0 ? normalizedDistance * maxRotation : -normalizedDistance * maxRotation;
  });

  const scale: MotionValue<number> = useTransform(distance, [0, 1, 2, 3], [1, 0.92, 0.85, 0.75]);
  const zIndex: MotionValue<number> = useTransform(distance, (d: number) => Math.round(500 - d * 100));
  const opacity: MotionValue<number> = useTransform(distance, [0, 1, 2, 4], [1, 0.8, 0.6, 0.3]);
  const brightness: MotionValue<number> = useTransform(distance, [0, 1, 2], [1, 0.7, 0.4]);
  const filterStr: MotionValue<string> = useTransform(brightness, (b: number) => `brightness(${b})`);

  const isActive = index === activeIndex;

  return (
    <motion.div
      className="shrink-0"
      style={{
        width: CARD_WIDTH,
        marginRight: CARD_GAP,
        rotateY,
        scale: isVisible ? scale : 0.85,
        zIndex,
        opacity: isVisible ? opacity : 0,
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
      onClick={onClick}
    >
      <motion.div
        className="group relative overflow-hidden rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_40px_rgba(229,9,20,0.12)]"
        style={{
          height: 380,
          filter: filterStr,
        }}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
      >
        {/* Poster image or gradient fallback */}
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: getGradient(movie.id) }}
          />
        )}

        {/* Shimmer placeholder animation */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: '-120%' }}
          animate={{ x: '120%' }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 48%, rgba(255,255,255,0) 100%)',
            mixBlendMode: 'overlay',
            opacity: 0.9,
          }}
        />

        {/* Movie info overlay */}
        <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black via-black/60 to-transparent p-4">
          {/* Rating badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 backdrop-blur-sm">
            <span className="text-xs font-bold text-netflix-red">★</span>
            <span className="text-xs font-semibold text-white">{movie.rating}</span>
          </div>

          {/* Genre pills */}
          <div className="mb-2 flex flex-wrap gap-1">
            {movie.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur-sm"
              >
                {g}
              </span>
            ))}
          </div>

          {/* Title */}
          <h3 className="text-base font-bold leading-tight tracking-tight text-white drop-shadow-lg">
            {movie.title}
          </h3>

          {/* Year */}
          <span className="mt-0.5 text-xs font-medium text-white/50">{movie.year}</span>

          {/* Description — visible on hover / active */}
          <p className={`mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/60 transition-opacity duration-300 ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}>
            {movie.description}
          </p>
        </div>

        {/* Active border glow — smooth fade */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-xl border-2 border-netflix-red/50 shadow-[0_0_30px_rgba(229,9,20,0.35)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
