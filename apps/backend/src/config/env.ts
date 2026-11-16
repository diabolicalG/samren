import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().min(1).optional(),
  MEDIA_STORAGE_ROOT: z.string().min(1).default(".data/media"),
  ANIVEXA_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  ANIVEXA_ALLOWED_HOSTS: z.string().default(""),
  ANIVEXA_STREAM_ALLOWED_HOSTS: z.string().default(""),
  ANIVEXA_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(11),
  ANIVEXA_WORKER_QUEUE_MAX: z.coerce.number().int().min(1).max(512).default(64),
  ANIVEXA_PROVIDER_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(20).default(3),
  ANIVEXA_PROVIDER_COOLDOWN_MS: z.coerce.number().int().min(1000).max(600000).default(30000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
