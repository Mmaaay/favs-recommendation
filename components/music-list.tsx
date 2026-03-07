"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, ExternalLink } from "lucide-react";
import type { MusicResult } from "@/lib/schemas";

type TaggedMusic = MusicResult & { type?: "entity" | "similar" };

export default function MusicList({ tracks }: { tracks: TaggedMusic[] }) {
  const entity = tracks.find((t) => t.type === "entity");
  const similar = tracks.filter((t) => t.type === "similar");

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      {/* Matched track */}
      {entity && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="mb-3 text-xl font-bold text-white">Matched Track</h2>
          <div className="flex items-center gap-4 rounded-xl border border-white/6 bg-white/3 p-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold text-white">
                {entity.name}
              </h3>
              <p className="text-sm text-white/50">{entity.artist}</p>
              {entity.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {entity.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-netflix-red/15 px-2 py-0.5 text-[10px] text-netflix-red/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {entity.url && (
              <a
                href={entity.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-white/8 p-2 text-white/50 transition-colors hover:bg-white/15 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </motion.div>
      )}

      {/* Similar tracks */}
      {similar.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="mb-3 text-xl font-bold text-white">
            Similar Tracks{" "}
            <span className="text-sm font-normal text-white/40">
              ({similar.length})
            </span>
          </h2>
          <div className="rounded-2xl border border-white/6 bg-linear-to-b from-netflix-gray/80 to-netflix-dark/90 shadow-[0_0_50px_rgba(229,9,20,0.08)] backdrop-blur-md">
            <AnimatePresence mode="popLayout">
              {similar.map((track, i) => (
                <TrackRow
                  key={`${track.name}-${track.artist}-${i}`}
                  track={track}
                  index={i}
                  isLast={i === similar.length - 1}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {tracks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-white/6 bg-linear-to-b from-netflix-gray/80 to-netflix-dark/90 p-12 text-center"
        >
          <Music className="mx-auto mb-3 h-10 w-10 text-white/20" />
          <p className="text-sm text-white/30">
            Search for a song to get recommendations
          </p>
        </motion.div>
      )}
    </div>
  );
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  isLast,
}: {
  track: TaggedMusic;
  index: number;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className={`group flex items-center gap-4 p-4 transition-colors hover:bg-white/3 ${
        !isLast ? "border-b border-white/6" : ""
      }`}
    >
      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h3 className="truncate text-sm font-bold text-white transition-colors duration-200 group-hover:text-netflix-red">
          {track.name}
        </h3>
        <p className="truncate text-xs text-white/40">{track.artist}</p>
        {track.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {track.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/50"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Playcount & link */}
      <div className="flex shrink-0 items-center gap-3">
        {track.playcount !== undefined && (
          <span className="text-xs text-white/30">
            {track.playcount > 1_000_000
              ? `${(track.playcount / 1_000_000).toFixed(1)}M`
              : track.playcount > 1_000
                ? `${(track.playcount / 1_000).toFixed(0)}K`
                : track.playcount}{" "}
            plays
          </span>
        )}
        {track.url && (
          <a
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/8 hover:text-white/70"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
});
