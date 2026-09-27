import type {
  Anime,
  AnimeListEntry,
  Download,
  Episode,
  Genre,
  HistoryEntry,
  PaginatedResult,
  Schedule,
  SearchResult,
  User,
  UserPreferences,
} from '@samren/types';

// The gateway address. Configure via NEXT_PUBLIC_API_URL in each app's
// .env.local; falls back to the default docker-compose/dev port.
const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000';

// --- Auth token storage -----------------------------------------------
// NOTE: there is currently no login UI anywhere in apps/web or apps/admin
// (see project analysis). Every user-scoped endpoint on the gateway
// (favorites, history, downloads, preferences, /auth/me) requires a bearer
// token tied to a real account. Until a login flow exists, calls that need
// auth will surface a clean 401/403 ApiError rather than crash the page —
// but they cannot succeed. This module exposes setAuthToken/clearAuthToken
// so a future login page can wire in without further api-client changes.

const TOKEN_KEY = 'samren_access_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore storage failures (e.g. private browsing) */
  }
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// --- Core request helper ------------------------------------------------

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  auth?: boolean;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const url = new URL(path.replace(/^\//, ''), API_BASE_URL + '/');
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', params, body, auth = false } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network failure (gateway unreachable, CORS, offline, etc.)
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = await response.json();
      detail = errBody?.detail ? JSON.stringify(errBody.detail) : detail;
    } catch {
      /* body wasn't JSON */
    }
    throw new ApiError(detail || `Request failed with ${response.status}`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// --- snake_case -> camelCase normalization ------------------------------
// The gateway's SQLModel-backed resources (favorites, history, downloads,
// user profile) serialize with Python's snake_case field names; everything
// else in this codebase (types package, page components) is camelCase.
// This is a real mismatch in the backend, not something to route around
// silently forever — but until the backend adds a camelCase alias
// generator, we normalize once here so the rest of the app can stay clean.

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function normalizeKeys<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => normalizeKeys(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toCamel(k)] = normalizeKeys(v);
    }
    return out as T;
  }
  return value as T;
}

// --- Anime / content endpoints (proxied through the gateway) -----------

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface AnimeListParams {
  status?: string;
  genres?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function getAnimeList(
  params: AnimeListParams = {},
): Promise<Envelope<PaginatedResult<Anime>>> {
  return request('/api/anime', { params: { ...params } });
}

export async function getTopAnime(
  params: { page?: number; limit?: number } = {},
): Promise<Envelope<PaginatedResult<Anime>>> {
  return request('/api/top', { params: { ...params } });
}

export async function getAnime(animeId: string): Promise<Envelope<Anime>> {
  return request(`/api/anime/${encodeURIComponent(animeId)}`);
}

export async function getEpisodes(animeId: string): Promise<Envelope<Episode[]>> {
  return request(`/api/anime/${encodeURIComponent(animeId)}/episodes`);
}

export async function getStreamUrl(
  animeId: string,
  episode: number,
  quality: string,
): Promise<Envelope<{ streamUrl: string | null; verified: boolean; quality: string; animeId: string; episode: number }>> {
  return request(`/api/anime/${encodeURIComponent(animeId)}/stream/${episode}`, {
    params: { quality },
  });
}

export async function searchAnime(
  q: string,
  params: { page?: number; limit?: number } = {},
): Promise<Envelope<SearchResult>> {
  return request('/api/search', { params: { q, ...params } });
}

export async function getGenres(): Promise<Envelope<Genre[]>> {
  return request('/api/genres');
}

export async function getSchedule(day?: string): Promise<Envelope<Schedule>> {
  return request('/api/schedule', { params: { day } });
}

// --- Auth -----------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}): Promise<User> {
  const raw = await request<Record<string, unknown>>('/api/auth/register', {
    method: 'POST',
    body: input,
  });
  return normalizeKeys<User>(raw);
}

export async function login(input: { email: string; password: string }): Promise<TokenResponse> {
  return request('/api/auth/login', { method: 'POST', body: input });
}

export async function getMe(): Promise<User> {
  const raw = await request<Record<string, unknown>>('/api/auth/me', { auth: true });
  return normalizeKeys<User>(raw);
}

// --- User preferences -------------------------------------------------

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const res = await request<Envelope<Record<string, unknown>>>(
    `/api/users/${encodeURIComponent(userId)}/preferences`,
    { auth: true },
  );
  const prefs = normalizeKeys<Partial<UserPreferences>>(res.data);
  return {
    player: prefs.player ?? 'auto',
    preferredQuality: prefs.preferredQuality ?? '1080p',
    theme: prefs.theme ?? 'dark',
    subtitles: prefs.subtitles ?? false,
    dub: prefs.dub ?? false,
  };
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const ACCEPTED = new Set([
    'player',
    'preferredQuality',
    'theme',
    'autoplay',
    'autoNext',
    'autoSkipIntro',
    'autoSkipOutro',
    'language',
    'subtitles',
    'dub',
  ]);
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (ACCEPTED.has(k) && v !== undefined) body[toSnake(k)] = v;
  }

  const res = await request<Envelope<Record<string, unknown>>>(
    `/api/users/${encodeURIComponent(userId)}/preferences`,
    { method: 'PATCH', body, auth: true },
  );
  const prefs = normalizeKeys<Partial<UserPreferences>>(res.data);
  return {
    player: prefs.player ?? 'auto',
    preferredQuality: prefs.preferredQuality ?? '1080p',
    theme: prefs.theme ?? 'dark',
    subtitles: prefs.subtitles ?? false,
    dub: prefs.dub ?? false,
  };
}

// --- Favorites (enriched with anime data client-side) -------------------

export async function getFavorites(userId: string): Promise<AnimeListEntry[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/users/${encodeURIComponent(userId)}/favorites`,
    { auth: true },
  );
  const entries = normalizeKeys<Omit<AnimeListEntry, 'anime'>[]>(raw);
  const withAnime = await Promise.all(
    entries.map(async (entry) => {
      try {
        const { data: anime } = await getAnime(entry.animeId);
        return { ...entry, anime } as AnimeListEntry;
      } catch {
        return { ...entry, anime: null as unknown as Anime } as AnimeListEntry;
      }
    }),
  );
  return withAnime;
}

export async function addFavorite(userId: string, animeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(userId)}/favorites`, {
    method: 'POST',
    body: { animeId },
    auth: true,
  });
}

export async function removeFavorite(userId: string, animeId: string): Promise<void> {
  await request(
    `/api/users/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(animeId)}`,
    { method: 'DELETE', auth: true },
  );
}

// --- History (enriched with anime data client-side) ----------------------

export async function getHistory(userId: string): Promise<HistoryEntry[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/users/${encodeURIComponent(userId)}/history`,
    { auth: true },
  );
  const entries = normalizeKeys<HistoryEntry[]>(raw);
  const withAnime = await Promise.all(
    entries.map(async (entry) => {
      try {
        const { data: anime } = await getAnime(entry.animeId);
        return { ...entry, anime };
      } catch {
        return entry;
      }
    }),
  );
  return withAnime;
}

export async function addHistory(
  userId: string,
  input: {
    animeId: string;
    episodeId: string;
    episodeNumber: number;
    currentTime: number;
    duration: number;
  },
): Promise<HistoryEntry> {
  const raw = await request<Record<string, unknown>>(
    `/api/users/${encodeURIComponent(userId)}/history`,
    {
      method: 'POST',
      body: {
        anime_id: input.animeId,
        episode_id: input.episodeId,
        episode_number: input.episodeNumber,
        current_time: input.currentTime,
        duration: input.duration,
      },
      auth: true,
    },
  );
  return normalizeKeys<HistoryEntry>(raw);
}

// --- Downloads ------------------------------------------------------

export async function getDownloads(userId: string): Promise<Download[]> {
  const raw = await request<Record<string, unknown>[]>(
    `/api/downloads/${encodeURIComponent(userId)}`,
    { auth: true },
  );
  return normalizeKeys<Download[]>(raw);
}

export async function createDownload(input: {
  animeId: string;
  episodeId: string;
  quality: string;
}): Promise<Download> {
  const raw = await request<Record<string, unknown>>('/api/downloads', {
    method: 'POST',
    body: { anime_id: input.animeId, episode_id: input.episodeId, quality: input.quality },
    auth: true,
  });
  return normalizeKeys<Download>(raw);
}

export async function clearDownloadsCache(userId: string): Promise<void> {
  await request(`/api/downloads/cache/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export { API_BASE_URL };
