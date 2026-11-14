import type { ApiEnvelope, HealthStatus } from "@samren/types";

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
  const baseUrl = (options.baseUrl ?? "/api/v1").replace(/\\/$/, "");
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

  return {
    request,
    health: () => request<HealthStatus>("/health"),
  };
}

export const apiClient = createApiClient();
