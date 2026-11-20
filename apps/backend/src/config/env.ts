import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().min(1).optional(),
  MEDIA_STORAGE_ROOT: z.string().trim().min(1).optional(),
  MEDIA_UPLOAD_IMAGE_MAX_BYTES: z.coerce.number().int().min(1).max(100 * 1024 * 1024).default(15 * 1024 * 1024),
  MEDIA_UPLOAD_VIDEO_MAX_BYTES: z.coerce.number().int().min(1).max(2 * 1024 * 1024 * 1024).default(2 * 1024 * 1024 * 1024),
  MEDIA_UPLOAD_SUBTITLE_MAX_BYTES: z.coerce.number().int().min(1).max(10 * 1024 * 1024).default(2 * 1024 * 1024),
  MEDIA_UPLOAD_TIMEOUT_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(900_000),
  ANIVEXA_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  ANIVEXA_ALLOWED_HOSTS: z.string().default(""),
  ANIVEXA_STREAM_ALLOWED_HOSTS: z.string().default(""),
  ANIVEXA_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(11),
  ANIVEXA_WORKER_QUEUE_MAX: z.coerce.number().int().min(1).max(512).default(64),
  ANIVEXA_PROVIDER_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(20).default(3),
  ANIVEXA_PROVIDER_COOLDOWN_MS: z.coerce.number().int().min(1000).max(600000).default(30000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment configuration: ${parsed.error.message}`);

const mediaStorageRoot = parsed.data.MEDIA_STORAGE_ROOT ?? ".data/media";
if (parsed.data.NODE_ENV === "production") {
  if (!parsed.data.MEDIA_STORAGE_ROOT || !path.isAbsolute(parsed.data.MEDIA_STORAGE_ROOT)) {
    throw new Error("MEDIA_STORAGE_ROOT must be explicitly configured as an absolute persistent path in production");
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const publicRoots = [
    path.join(repoRoot, "public"),
    path.join(repoRoot, "apps", "frontend", "public"),
    path.join(repoRoot, "apps", "backend", "public"),
  ];
  const configuredRoot = path.resolve(parsed.data.MEDIA_STORAGE_ROOT);
  if (publicRoots.some((publicRoot) => configuredRoot === publicRoot || configuredRoot.startsWith(publicRoot + path.sep))) {
    throw new Error("MEDIA_STORAGE_ROOT must be outside public web roots");
  }
}

export const env = { ...parsed.data, MEDIA_STORAGE_ROOT: mediaStorageRoot };
export const isProduction = env.NODE_ENV === "production";
