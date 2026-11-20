import type { AdminAnimeWriteInput, AdminAuthUser, AdminCatalogAnime, AdminCatalogEpisode, AdminEpisodeMedia, AdminMediaAsset, AdminSubtitleTrack, ApiEnvelope, CatalogAnimeDetail, CatalogAnimeCard, CatalogEpisode, CatalogListParams, CatalogPage, CatalogPublicationStatus, CatalogPlayback, CatalogSeason, CatalogTaxonomyItem, HealthStatus } from "@samren/types";

export type ApiClientOptions = {
  baseUrl?: string;
  credentials?: RequestCredentials;
};

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? "/api/v1").replace(/\/$/, "");
  const credentials = options.credentials ?? "include";

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      credentials,
      headers: { Accept: "application/json", ...init.headers },
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => null) as ApiEnvelope<T> | null;
    if (!response.ok || !body || body.error) {
      const error = body && "error" in body ? body.error : null;
      throw new ApiError(response.status, error?.code ?? "REQUEST_FAILED", error?.message ?? "The request could not be completed");
    }
    return body.data;
  }

  function queryString(params: CatalogListParams = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    }
    const encoded = search.toString();
    return encoded ? `?${encoded}` : "";
  }

  return {
    request,
    health: () => request<HealthStatus>("/health"),
    authSession: () => request<{ user: AdminAuthUser }>("/auth/session"),
    authLogin: (email: string, password: string) => request<{ user: AdminAuthUser; expiresAt: string }>("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }),
    authLogout: () => request<void>("/auth/logout", { method: "POST" }),
    adminCatalogAnime: () => request<{ items: AdminCatalogAnime[] }>("/admin/catalog/anime"),
    adminCatalogEpisodes: (animeId: string) => request<AdminCatalogEpisode[]>("/admin/catalog/anime/" + encodeURIComponent(animeId) + "/episodes"),
    adminCatalogAssets: () => request<AdminMediaAsset[]>("/admin/catalog/assets"),
    adminMediaUploadLimits: () => request<Record<AdminMediaAsset["mediaKind"], number>>("/admin/catalog/assets/upload-limits"),
    adminUploadAsset: (file: File, mediaKind: AdminMediaAsset["mediaKind"]) => {
      const body = new FormData();
      body.append("file", file, file.name);
      return request<AdminMediaAsset>("/admin/catalog/assets/upload", { method: "POST", headers: { "x-media-kind": mediaKind }, body });
    },
    adminCreateAsset: (input: { storageKey: string; originalFilename: string; mediaKind: AdminMediaAsset["mediaKind"]; mimeType: string; sizeBytes: number; width?: number | null; height?: number | null; durationSeconds?: number | null; checksumSha256?: string | null }) => request<AdminMediaAsset>("/admin/catalog/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateAsset: (id: string, input: { originalFilename?: string; mimeType?: string; sizeBytes?: number; width?: number | null; height?: number | null; durationSeconds?: number | null; checksumSha256?: string | null }) => request<AdminMediaAsset>("/admin/catalog/assets/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminDeleteAsset: (id: string) => request<void>("/admin/catalog/assets/" + encodeURIComponent(id), { method: "DELETE" }),
    adminCreateEpisode: (input: { animeId: string; episodeNumber: number; title: string; synopsis?: string | null; durationSeconds?: number | null; publicationStatus?: CatalogPublicationStatus; isFiller?: boolean; isRecap?: boolean }) => request<AdminCatalogEpisode>("/admin/catalog/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateEpisode: (id: string, input: { episodeNumber?: number; title?: string; synopsis?: string | null; durationSeconds?: number | null; publicationStatus?: CatalogPublicationStatus; isFiller?: boolean; isRecap?: boolean }) => request<AdminCatalogEpisode>("/admin/catalog/episodes/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminArchiveEpisode: (id: string) => request<AdminCatalogEpisode>("/admin/catalog/episodes/" + encodeURIComponent(id), { method: "DELETE" }),
    adminEpisodeMedia: (episodeId: string) => request<AdminEpisodeMedia[]>("/admin/catalog/episodes/" + encodeURIComponent(episodeId) + "/media"),
    adminCreateEpisodeMedia: (episodeId: string, input: { assetId: string; qualityLabel?: string | null; isDefault?: boolean }) => request<AdminEpisodeMedia>("/admin/catalog/episodes/" + encodeURIComponent(episodeId) + "/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateEpisodeMedia: (id: string, input: { qualityLabel?: string | null; isDefault?: boolean }) => request<AdminEpisodeMedia>("/admin/catalog/episode-media/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminDeleteEpisodeMedia: (id: string) => request<void>("/admin/catalog/episode-media/" + encodeURIComponent(id), { method: "DELETE" }),
    adminSubtitleTracks: (episodeId: string) => request<AdminSubtitleTrack[]>("/admin/catalog/episodes/" + encodeURIComponent(episodeId) + "/subtitles"),
    adminCreateSubtitleTrack: (episodeId: string, input: { assetId: string; languageCode: string; label: string; format: "SRT" | "VTT" | "ASS"; isDefault?: boolean }) => request<AdminSubtitleTrack>("/admin/catalog/episodes/" + encodeURIComponent(episodeId) + "/subtitles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateSubtitleTrack: (id: string, input: { languageCode?: string; label?: string; format?: "SRT" | "VTT" | "ASS"; isDefault?: boolean }) => request<AdminSubtitleTrack>("/admin/catalog/subtitle-tracks/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminDeleteSubtitleTrack: (id: string) => request<void>("/admin/catalog/subtitle-tracks/" + encodeURIComponent(id), { method: "DELETE" }),
    adminCatalogGenres: () => request<CatalogTaxonomyItem[]>("/admin/catalog/genres"),
    adminCatalogStudios: () => request<CatalogTaxonomyItem[]>("/admin/catalog/studios"),
    adminCatalogSeasons: () => request<CatalogSeason[]>("/admin/catalog/seasons"),
    adminCreateGenre: (input: { slug: string; name: string }) => request<CatalogTaxonomyItem>("/admin/catalog/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateGenre: (id: string, input: { slug?: string; name?: string }) => request<CatalogTaxonomyItem>("/admin/catalog/genres/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminDeleteGenre: (id: string) => request<void>("/admin/catalog/genres/" + encodeURIComponent(id), { method: "DELETE" }),
    adminCreateStudio: (input: { slug: string; name: string; description?: string | null; website?: string | null }) => request<CatalogTaxonomyItem>("/admin/catalog/studios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateStudio: (id: string, input: { slug?: string; name?: string; description?: string | null; website?: string | null }) => request<CatalogTaxonomyItem>("/admin/catalog/studios/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminDeleteStudio: (id: string) => request<void>("/admin/catalog/studios/" + encodeURIComponent(id), { method: "DELETE" }),
    adminCreateSeason: (input: { year: number; season: CatalogSeason["season"]; label?: string | null }) => request<CatalogSeason>("/admin/catalog/seasons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateSeason: (id: string, input: { year?: number; season?: CatalogSeason["season"]; label?: string | null }) => request<CatalogSeason>("/admin/catalog/seasons/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminDeleteSeason: (id: string) => request<void>("/admin/catalog/seasons/" + encodeURIComponent(id), { method: "DELETE" }),
    adminCreateAnime: (input: AdminAnimeWriteInput & { title: string }) => request<AdminCatalogAnime>("/admin/catalog/anime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateAnime: (id: string, input: AdminAnimeWriteInput) => request<AdminCatalogAnime>("/admin/catalog/anime/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminArchiveAnime: (id: string) => request<{ id: string; slug: string; publicationStatus: "ARCHIVED" }>("/admin/catalog/anime/" + encodeURIComponent(id), { method: "DELETE" }),
    catalogAnime: (params: CatalogListParams = {}) => request<CatalogPage<CatalogAnimeCard>>(`/catalog/anime${queryString(params)}`),
    catalogAnimeBySlug: (slug: string) => request<CatalogAnimeDetail>(`/catalog/anime/${encodeURIComponent(slug)}`),
    catalogEpisodes: (slug: string) => request<CatalogEpisode[]>(`/catalog/anime/${encodeURIComponent(slug)}/episodes`),
    catalogPlayback: (slug: string, episodeNumber: number) => request<CatalogPlayback>(`/catalog/anime/${encodeURIComponent(slug)}/episodes/${episodeNumber}/playback`),
    catalogGenres: () => request<CatalogTaxonomyItem[]>("/catalog/genres"),
    catalogStudios: () => request<CatalogTaxonomyItem[]>("/catalog/studios"),
    catalogSeasons: () => request<CatalogSeason[]>("/catalog/seasons"),
    aggregatePlayback: (anilistId: number, episode: number, audio: "sub" | "dub" = "sub") =>
      request<{ sessionId: string; stream: { provider: string; url: string; type: "hls" | "mp4" | "dash"; server: string; quality: string; audio: "sub" | "dub"; referer?: string; subtitles?: Array<{ url: string; label: string; srclang: string; default?: boolean }> }; providers: number; expiresAt: string }>(`/anivexa/aggregate/${anilistId}/${episode}?audio=${audio}`),
    fallbackPlayback: (sessionId: string, failedProvider: string) =>
      request<{ stream: { provider: string; url: string; type: "hls" | "mp4" | "dash"; server: string; quality: string; audio: "sub" | "dub"; referer?: string; subtitles?: Array<{ url: string; label: string; srclang: string; default?: boolean }> }; tried: string[]; remaining: number }>(`/anivexa/aggregate/${encodeURIComponent(sessionId)}/fallback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: failedProvider }) }),
    closePlaybackSession: (sessionId: string) =>
      request<void>(`/anivexa/aggregate/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
  };
}

export const apiClient = createApiClient();
