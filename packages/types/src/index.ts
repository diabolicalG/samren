export type ISODateString = string;

// NOTE: these mirror the *actual* shapes returned by services/shivra-api's
// Jikan transforms (see services/shivra-api/scrapers/transform.py), not the
// (unused) prisma/schema.prisma model. The two disagree on casing and on a
// few field names (e.g. `episodes` vs `episodeCount`) — this file follows
// the real wire format so the frontend doesn't silently break on it.

export type AnimeStatus = 'ongoing' | 'completed' | 'released' | 'tba';
export type AnimeKind = 'tv' | 'movie' | 'ova' | 'special' | 'ona' | 'music';
export type Season = 'winter' | 'spring' | 'summer' | 'fall' | null;

export type PlayerType = 'auto' | 'browser' | 'mpv';
export type Theme = 'dark' | 'light';
export type VideoQuality = '360p' | '480p' | '720p' | '1080p';

export interface Genre {
  id: string;
  name: string;
  description: string | null;
}

export interface Studio {
  id: string;
  name: string;
  logo: string | null;
  url: string | null;
}

export interface Tag {
  id: string;
  name: string;
  description?: string | null;
}

export interface Trailer {
  url: string | null;
  site: string | null;
}

export interface Anime {
  id: string;
  title: string;
  nativeTitle: string | null;
  description: string;
  coverImage: string;
  bannerImage: string | null;
  rating: number;
  status: AnimeStatus;
  type: AnimeKind;
  episodes: number;
  duration: number;
  year: number;
  season: Season;
  source: string;
  genres: Genre[];
  studios: Studio[];
  tags: Tag[];
  trailer?: Trailer | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Episode {
  id: string;
  animeId: string;
  number: number;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  duration: number;
  isFiller: boolean;
  isPreview: boolean;
  airDate: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface SearchResult {
  animes: Anime[];
  total: number;
  page: number;
  hasNext: boolean;
}

export type Schedule = Record<string, Anime[]>;

export interface UserPreferences {
  player: PlayerType;
  preferredQuality: VideoQuality;
  theme: Theme;
  subtitles: boolean;
  dub: boolean;
  autoplay?: boolean;
  autoNext?: boolean;
  autoSkipIntro?: boolean;
  autoSkipOutro?: boolean;
  language?: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  player: 'auto',
  preferredQuality: '1080p',
  theme: 'dark',
  subtitles: false,
  dub: false,
};

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  avatar: string | null;
  preferences: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastSeenAt: ISODateString | null;
}

export type ListStatus =
  | 'watching'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'plan_to_watch';

export interface AnimeListEntry {
  id: string;
  userId: string;
  animeId: string;
  status: ListStatus;
  score: number | null;
  progress: number;
  totalEpisodes: number;
  repeat: number;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Enriched client-side by @samren/api-client — the gateway does not join
  // anime data onto this resource.
  anime: Anime;
}

export interface HistoryEntry {
  id: string;
  userId: string;
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  currentTime: number;
  duration: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Enriched client-side by @samren/api-client.
  anime?: Anime;
}

export type DownloadStatus = 'downloading' | 'completed' | 'failed' | 'queued';

export interface Download {
  id: string;
  userId: string;
  animeId: string;
  episodeId: string;
  quality: string;
  filename: string;
  fileSize: number;
  status: DownloadStatus;
  progress: number;
  path: string;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
