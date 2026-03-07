# Favs Recommendation

An AI-powered recommendation engine for discovering movies, TV series, and music. Describe what you're looking for in plain language — even vaguely — and let Gemini AI figure out the rest, then get personalized recommendations powered by TMDB and Last.fm.

## Features

### Movie & TV Series Finder

- **Vague search** — Describe a movie informally (e.g. _"that movie where the guy is stuck in a cave"_) and Gemini AI identifies the canonical title using Google Search
- **Genre browsing** — Pick from 18+ genre filters (Action, Comedy, Drama, Horror, Sci-Fi, etc.) to discover content by category
- **Exact name search** — Search directly by title for known movies or shows
- **Content type toggle** — Filter between Movies, TV Series, or Both
- **Duration filter** — Filter TV series by episode count (Short ≤16, Medium 17–60, Long >60)
- **Smart recommendations** — Once a match is found, fetches related titles from TMDB and streams results in real-time

### Music Finder

- **AI song identification** — Describe a song or paste partial lyrics, and Gemini maps it to the canonical track
- **Similar track recommendations** — Expands from up to 3 seed tracks, deduplicates results, and returns up to 24 similar tracks
- **Variant filtering** — Automatically filters out live, remaster, and karaoke versions unless you specifically ask for them
- **Last.fm fallback** — If AI identification fails, falls back to a direct Last.fm search

### UI

- **3D Coverflow Carousel** — Draggable card carousel with perspective transforms, dynamic scaling, brightness, and shimmer placeholders
- **Streaming results** — Server actions stream data to the client for progressive rendering
- **Dark theme** — Netflix-inspired dark interface

## Tech Stack

| Layer         | Technologies                                                                             |
| ------------- | ---------------------------------------------------------------------------------------- |
| Framework     | Next.js 16, React 19, TypeScript 5                                                       |
| AI            | Vercel AI SDK, Google Gemini 2.5 Flash, `@ai-sdk/google`                                 |
| APIs          | [TMDB](https://www.themoviedb.org/) (movies/TV), [Last.fm](https://www.last.fm/) (music) |
| Styling       | Tailwind CSS 4, shadcn/ui, Radix UI, Framer Motion                                       |
| Rate Limiting | Upstash Redis + sliding window                                                           |
| Validation    | Zod 4                                                                                    |
| Tooling       | ESLint 9, Prettier, Husky, pnpm                                                          |

## How It Works

### Movie Search Pipeline

```
User Input → classifyInput()
  ├─ GENRE       → fetchByGenre()          [TMDB genre browse]
  ├─ EXACT_NAME  → fetchByName()           [TMDB search + recommendations]
  └─ VAGUE       → identifyEntity()        [Gemini + Google Search]
                     → fetchByName()        [TMDB search + recommendations]
                        → stream results to UI
```

1. The user's input is classified as a genre keyword, an exact title, or a vague description
2. Vague descriptions go through Gemini 2.5 Flash with Google Search grounding to identify the canonical title and media type
3. The identified title is searched on TMDB, and related recommendations are fetched
4. Results are streamed to the client in real-time via `createStreamableValue` / `readStreamableValue`

### Music Search Pipeline

```
User Input → identifySong()  [Gemini + Google Search]
  ├─ Search Last.fm for matched track
  └─ getRecommendations()
       → track info + 12 similar tracks
       → 3-seed expansion [dedup + variant filtering]
       → stream results to UI
```

1. Gemini identifies the canonical track name and artist
2. Last.fm looks up the track and fetches similar tracks
3. Expands recommendations from multiple seed tracks, deduplicates by normalized artist+name, and filters variants
4. Results are streamed progressively to the client

### Rate Limiting

All API-facing functions are rate-limited via Upstash Redis with sliding windows:

| Function                 | Limit        |
| ------------------------ | ------------ |
| Movie search action      | 10 req / 60s |
| AI entity identification | 5 req / 60s  |
| TMDB API calls           | 30 req / 60s |
| Music search action      | 10 req / 60s |
| Last.fm API calls        | 30 req / 60s |

### Security

Both TMDB and Last.fm clients are hardened with:

- Path validation (no directory traversal)
- Parameter allowlisting to prevent API key override
- Hostname pinning
- Max parameter length enforcement (200 chars)

## Project Structure

```
app/
├── layout.tsx              # Root layout (dark theme, Geist font)
├── page.tsx                # Main page with Movies/Music tabs
├── globals.css             # Global styles
└── actions/
    ├── search.ts           # Server action: movie/TV AI search
    └── music-search.ts     # Server action: music AI search
components/
├── coverflow-carousel.tsx  # 3D draggable card carousel
├── movie-list.tsx          # Movie/TV results grid
├── music-list.tsx          # Music results with matched entity card
├── search-box.tsx          # Search input + genre/filter controls
└── ui/                     # shadcn primitives (button, input)
lib/
├── tmdb.ts                 # TMDB API client (security-hardened)
├── lastfm.ts               # Last.fm API client (security-hardened)
├── schemas.ts              # Zod schemas (MovieResult, MusicResult)
├── rate-limit.ts           # Upstash rate limiter instances
├── hooks.ts                # useDebounce hook
├── movies.ts               # Movie type interface
└── utils.ts                # cn(), normalizeSearch(), tokenizeSearch()
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

### Environment Variables

Create a `.env.local` file in the project root:

```env
TMDB_API_KEY=your_tmdb_api_key
TMDB_URL=https://api.themoviedb.org/3
LASTFM_API_KEY=your_lastfm_api_key
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

You can obtain these from:

- **TMDB** — [developer.themoviedb.org](https://developer.themoviedb.org/)
- **Last.fm** — [last.fm/api](https://www.last.fm/api)
- **Upstash** — [upstash.com](https://upstash.com/)
- **Google AI** — [aistudio.google.com](https://aistudio.google.com/)

### Install & Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other Scripts

```bash
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # Run ESLint
pnpm typecheck      # Run TypeScript type checking
pnpm format         # Format with Prettier
pnpm check          # Run all checks (typecheck + lint + format)
```

## Deploy

Deploy on [Vercel](https://vercel.com/) — add your environment variables in the project settings and deploy. No additional configuration needed.
