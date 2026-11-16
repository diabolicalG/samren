import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { getAnimeGGStreams } from "./animegg.js";
import { getAniZoneStreams } from "./anizone.js";
import { getAniKotoStreams } from "./anikoto.js";
import { getKaaStreams } from "./kaa.js";
import { getAniWavesStreams, getReAnimeStreams, getAnimeOnsenStreams, getAnimeNoSubStreams, getAniPmStreams, getSenshiStreams, getAnimeDunyaStreams } from "./legacy-adapters.js";
import { anivexaStreamAllowedHosts, isAnivexaUrlAllowed } from "./http.js";
import { BoundedWorkerPool, ProviderCircuitBreaker } from "./worker-pool.js";

export type AudioType = "sub" | "dub";
export type ProviderId = "animegg" | "anizone" | "anikoto" | "kaa" | "aniwaves" | "reanime" | "animeonsen" | "animenosub" | "anipm" | "senshi" | "animedunya";
export type AggregatedStream = {
  provider: ProviderId;
  url: string;
  type: "hls" | "mp4" | "dash";
  server: string;
  quality: string;
  audio: AudioType;
  referer?: string;
  subtitles?: Array<{ url: string; label: string; srclang: string; default?: boolean }>;
};

export type ProviderAdapter = {
  id: ProviderId;
  label: string;
  extract: (anilistId: number, episode: number, audio: AudioType) => Promise<unknown>;
};

type ProviderResult = { streams?: unknown[] };
type Session = {
  id: string;
  anilistId: number;
  episode: number;
  audio: AudioType;
  createdAt: number;
  expiresAt: number;
  activeProvider: ProviderId;
  tried: Set<ProviderId>;
  tasks: Map<ProviderId, Promise<AggregatedStream>>;
};

const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS = 1_000;
const SUPPORTED_TYPES = new Set(["hls", "mp4", "dash"]);

const adapters: ProviderAdapter[] = [
  { id: "animegg", label: "AnimeGG", extract: async (id, episode, audio) => getAnimeGGStreams(id, episode, audio) },
  { id: "anizone", label: "AniZone", extract: async (id, episode, audio) => getAniZoneStreams(id, episode, audio) },
  { id: "anikoto", label: "AniKoto", extract: async (id, episode, audio) => getAniKotoStreams(id, episode, audio) },
  { id: "kaa", label: "KickAssAnime", extract: async (id, episode, audio) => getKaaStreams(id, episode, audio) },
  { id: "aniwaves", label: "AniWaves", extract: async (id, episode, audio) => getAniWavesStreams(id, episode, audio) },
  { id: "reanime", label: "ReAnime", extract: async (id, episode, audio) => getReAnimeStreams(id, episode, audio) },
  { id: "animeonsen", label: "AnimeOnsen", extract: async (id, episode, audio) => getAnimeOnsenStreams(id, episode, audio) },
  { id: "animenosub", label: "AnimeNoSub", extract: async (id, episode, audio) => getAnimeNoSubStreams(id, episode, audio) },
  { id: "anipm", label: "Ani.pm", extract: async (id, episode, audio) => getAniPmStreams(id, episode, audio) },
  { id: "senshi", label: "Senshi", extract: async (id, episode, audio) => getSenshiStreams(id, episode, audio) },
  { id: "animedunya", label: "AnimeDunya", extract: async (id, episode, audio) => getAnimeDunyaStreams(id, episode, audio) },
];

function safeText(value: unknown, fallback: string, max = 100): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function normalizeStream(provider: ProviderId, audio: AudioType, raw: unknown, allowedHosts: Set<string>): AggregatedStream | null {
  if (!raw || typeof raw !== "object") return null;
  const stream = raw as Record<string, unknown>;
  if (typeof stream.url !== "string" || typeof stream.type !== "string") return null;
  const type = stream.type.toLowerCase();
  if (!SUPPORTED_TYPES.has(type)) return null;
  if (!isAnivexaUrlAllowed(stream.url, allowedHosts)) return null;
  const subtitles = Array.isArray(stream.subtitles) ? stream.subtitles.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const subtitle = item as Record<string, unknown>;
    if (typeof subtitle.url !== "string" || !isAnivexaUrlAllowed(subtitle.url, allowedHosts)) return [];
    return [{
      url: subtitle.url,
      label: safeText(subtitle.label, "Subtitle"),
      srclang: safeText(subtitle.srclang, "und", 16),
      default: subtitle.default === true,
    }];
  }) : undefined;
  const result: AggregatedStream = {
    provider,
    url: stream.url,
    type: type as AggregatedStream["type"],
    server: safeText(stream.server, provider.toUpperCase()),
    quality: safeText(stream.quality, "auto", 32),
    audio,
  };
  if (typeof stream.referer === "string" && stream.referer.startsWith("https://")) result.referer = stream.referer.slice(0, 500);
  if (subtitles?.length) result.subtitles = subtitles;
  return result;
}

export class ProviderAggregator {
  private readonly sessions = new Map<string, Session>();
  private readonly pool: BoundedWorkerPool;
  private readonly circuits: ProviderCircuitBreaker;
  private readonly adapters: ProviderAdapter[];
  private readonly streamAllowedHosts: Set<string>;

  constructor(
    options: { concurrency?: number; maxQueue?: number; failureThreshold?: number; cooldownMs?: number; streamAllowedHosts?: Set<string> } = {},
    providers: ProviderAdapter[] = adapters,
  ) {
    this.pool = new BoundedWorkerPool(options.concurrency ?? 4, options.maxQueue ?? 64);
    this.circuits = new ProviderCircuitBreaker(options.failureThreshold ?? 3, options.cooldownMs ?? 30_000);
    this.adapters = providers;
    this.streamAllowedHosts = options.streamAllowedHosts ?? anivexaStreamAllowedHosts();
  }

  get status() {
    return {
      workers: this.pool.stats,
      providers: this.adapters.map((adapter) => ({ id: adapter.id, name: adapter.label, ...this.circuits.status(adapter.id) })),
    };
  }

  private prune(now = Date.now()): void {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
    while (this.sessions.size >= MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.sessions.delete(oldest);
    }
  }

  private task(adapter: ProviderAdapter, anilistId: number, episode: number, audio: AudioType): Promise<AggregatedStream> {
    return this.pool.run(async () => {
      if (this.circuits.isOpen(adapter.id)) throw new Error("Provider circuit is open");
      try {
        const result = await adapter.extract(anilistId, episode, audio) as ProviderResult;
        const streams = Array.isArray(result?.streams) ? result.streams : [];
        for (const raw of streams) {
          const candidate = normalizeStream(adapter.id, audio, raw, this.streamAllowedHosts);
          if (candidate) {
            this.circuits.success(adapter.id);
            return candidate;
          }
        }
        throw new Error("Provider returned no allowlisted playable stream");
      } catch (error) {
        this.circuits.failure(adapter.id);
        throw error;
      }
    });
  }

  private async firstAvailable(session: Session): Promise<AggregatedStream> {
    const pending = [...session.tasks.entries()]
      .filter(([provider]) => !session.tried.has(provider))
      .map(([, task]) => task);
    if (!pending.length) throw new Error("No untried providers remain");
    const selected = await Promise.any(pending);
    session.activeProvider = selected.provider;
    session.tried.add(selected.provider);
    return selected;
  }

  async start(anilistId: number, episode: number, audio: AudioType): Promise<{ sessionId: string; stream: AggregatedStream; providers: number; expiresAt: string }> {
    this.prune();
    const id = randomUUID();
    const now = Date.now();
    const session: Session = {
      id,
      anilistId,
      episode,
      audio,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      activeProvider: "animegg",
      tried: new Set(),
      tasks: new Map(),
    };
    for (const adapter of this.adapters) {
      session.tasks.set(adapter.id, this.task(adapter, anilistId, episode, audio));
    }
    this.sessions.set(id, session);
    try {
      const stream = await this.firstAvailable(session);
      return { sessionId: id, stream, providers: this.adapters.length, expiresAt: new Date(session.expiresAt).toISOString() };
    } catch {
      this.sessions.delete(id);
      throw new Error("All configured providers failed to return a playable stream");
    }
  }

  async fallback(sessionId: string, failedProvider: ProviderId): Promise<{ stream: AggregatedStream; tried: ProviderId[]; remaining: number }> {
    this.prune();
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Playback session expired or was not found");
    if (session.activeProvider !== failedProvider) throw new Error("Reported failed provider does not match the active provider");
    session.tried.add(failedProvider);
    const stream = await this.firstAvailable(session);
    return {
      stream,
      tried: [...session.tried],
      remaining: this.adapters.length - session.tried.size,
    };
  }

  async close(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export const providerAggregator = new ProviderAggregator({
  concurrency: env.ANIVEXA_WORKER_CONCURRENCY,
  maxQueue: env.ANIVEXA_WORKER_QUEUE_MAX,
  failureThreshold: env.ANIVEXA_PROVIDER_FAILURE_THRESHOLD,
  cooldownMs: env.ANIVEXA_PROVIDER_COOLDOWN_MS,
});
