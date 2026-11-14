import type { AdminAnimeWriteInput, AdminAuthUser, AdminCatalogAnime, AdminCatalogEpisode, ApiEnvelope, CatalogAnimeDetail, CatalogAnimeCard, CatalogEpisode, CatalogListParams, CatalogPage, CatalogSeason, CatalogTaxonomyItem, HealthStatus } from "@samren/types";

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
    adminCreateEpisode: (input: { animeId: string; episodeNumber: number; title: string; synopsis?: string | null; durationSeconds?: number | null; publicationStatus?: CatalogPublicationStatus; isFiller?: boolean; isRecap?: boolean }) => request<AdminCatalogEpisode>("/admin/catalog/episodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminUpdateEpisode: (id: string, input: { episodeNumber?: number; title?: string; synopsis?: string | null; durationSeconds?: number | null; publicationStatus?: CatalogPublicationStatus; isFiller?: boolean; isRecap?: boolean }) => request<AdminCatalogEpisode>("/admin/catalog/episodes/" + encodeURIComponent(id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
    adminArchiveEpisode: (id: string) => request<AdminCatalogEpisode>("/admin/catalog/episodes/" + encodeURIComponent(id), { method: "DELETE" }),
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
    catalogGenres: () => request<CatalogTaxonomyItem[]>("/catalog/genres"),
    catalogStudios: () => request<CatalogTaxonomyItem[]>("/catalog/studios"),
    catalogSeasons: () => request<CatalogSeason[]>("/catalog/seasons"),
  };
}

export const apiClient = createApiClient();
