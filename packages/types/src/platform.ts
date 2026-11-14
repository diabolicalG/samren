export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export type HealthStatus = {
  status: "ok";
  service: "samren-api";
  timestamp: string;
};

export type UserRole = "USER" | "MODERATOR" | "ADMIN";

export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";