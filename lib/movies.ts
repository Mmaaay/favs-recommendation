export interface Movie {
  id: number;
  title: string;
  poster?: string;
  year: string;
  rating: string;
  genres: string[];
  description: string;
  mediaType?: "movie" | "tv_series";
  episodeCount?: number | null;
}
