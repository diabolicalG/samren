export type ISODateString = string;

export enum Status {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  RELEASED = 'RELEASED',
  TBA = 'TBA',
}

export enum AnimeType {
  TV = 'TV',
  MOVIE = 'MOVIE',
  OVA = 'OVA',
  SPECIAL = 'SPECIAL',
  ONA = 'ONA',
  MUSIC = 'MUSIC',
}

export enum Season {
  WINTER = 'WINTER',
  SPRING = 'SPRING',
  SUMMER = 'SUMMER',
  FALL = 'FALL',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}

export enum ListStatus {
  WATCHING = 'WATCHING',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  DROPPED = 'DROPPED',
  PLAN_TO_WATCH = 'PLAN_TO_WATCH',
}

export enum VideoQuality {
  Q360P = 'Q360P',
  Q480P = 'Q480P',
  Q720P = 'Q720P',
  Q1080P = 'Q1080P',
}

export enum DownloadStatus {
  DOWNLOADING = 'DOWNLOADING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  QUEUED = 'QUEUED',
}

export interface Anime {
  id: string;
  title: string;
  nativeTitle: string | null;
  description: string;
  coverImage: string;
  bannerImage: string | null;
  rating: number;
  status: Status;
  type: AnimeType;
  episodeCount: number;
  duration: number;
  year: number;
  season: Season;
  source: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  genres?: AnimeGenre[];
  studios?: AnimeStudio[];
  tags?: AnimeTag[];
  episodes?: Episode[];
  history?: HistoryEntry[];
  favorites?: AnimeListEntry[];
  downloads?: Download[];
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
  anime?: Anime;
  downloads?: Download[];
  history?: HistoryEntry[];
}

export interface Genre {
  id: string;
  name: string;
  description: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  animeGenres?: AnimeGenre[];
}

export interface AnimeGenre {
  id: string;
  animeId: string;
  genreId: string;
  anime?: Anime;
  genre?: Genre;
}

export interface Studio {
  id: string;
  name: string;
  logo: string | null;
  url: string | null;
  animeStudios?: AnimeStudio[];
}

export interface AnimeStudio {
  id: string;
  animeId: string;
  studioId: string;
  anime?: Anime;
  studio?: Studio;
}

export interface Tag {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isRestricted: boolean;
  rank: number | null;
  animeTags?: AnimeTag[];
}

export interface AnimeTag {
  id: string;
  animeId: string;
  tagId: string;
  anime?: Anime;
  tag?: Tag;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  avatar: string | null;
  preferences: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastSeenAt: ISODateString | null;
  history?: HistoryEntry[];
  favorites?: AnimeListEntry[];
  downloads?: Download[];
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
  user?: User;
  anime?: Anime;
  episode?: Episode;
}

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
  user?: User;
  anime?: Anime;
}

export interface Download {
  id: string;
  userId: string;
  animeId: string;
  episodeId: string;
  quality: VideoQuality;
  filename: string;
  fileSize: number;
  status: DownloadStatus;
  progress: number;
  path: string;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  user?: User;
  anime?: Anime;
  episode?: Episode;
}

export interface Cache {
  id: string;
  key: string;
  value: Record<string, unknown> | unknown[] | string | number | boolean | null;
  expiresAt: ISODateString;
  createdAt: ISODateString;
}
