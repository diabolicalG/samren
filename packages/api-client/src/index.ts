import type { ApiEnvelope, CatalogAnimeDetail, CatalogAnimeCard, CatalogEpisode, CatalogListParams, CatalogPage, CatalogSeason, CatalogTaxonomyItem, HealthStatus } from "@samren/types";

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
    catalogAnime: (params: CatalogListParams = {}) => request<CatalogPage<CatalogAnimeCard>>(`/catalog/anime${queryString(params)}`),
    catalogAnimeBySlug: (slug: string) => request<CatalogAnimeDetail>(`/catalog/anime/${encodeURIComponent(slug)}`),
    catalogEpisodes: (slug: string) => request<CatalogEpisode[]>(`/catalog/anime/${encodeURIComponent(slug)}/episodes`),
    catalogGenres: () => request<CatalogTaxonomyItem[]>("/catalog/genres"),
    catalogStudios: () => request<CatalogTaxonomyItem[]>("/catalog/studios"),
    catalogSeasons: () => request<CatalogSeason[]>("/catalog/seasons"),
  };
}

export const apiClient = createApiClient();
