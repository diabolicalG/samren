import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { anivexaAllowedHosts, anivexaStreamAllowedHosts } from "./http.js";
import { isAnivexaUrlAllowed } from "./core/safe-fetch.js";

export type PlaybackResourceKind = "hls" | "dash" | "mp4" | "vtt" | "segment" | "auto";
export type PlaybackResourceInput = {
  url: string;
  referer?: string;
  sessionToken: string;
  providerSessionId: string;
  kind?: PlaybackResourceKind;
};
export type PlaybackResource = {
  url: string;
  referer?: string;
  providerSessionId: string;
  kind: PlaybackResourceKind;
  expiresAt: number;
};

type StoredResource = PlaybackResource & { sessionHash: string };
type BoundSession = { sessionHash: string; expiresAt: number };

const RESOURCE_TTL_MS = 10 * 60 * 1_000;
const MAX_RESOURCES = 5_000;
const resources = new Map<string, StoredResource>();
const providerSessions = new Map<string, BoundSession>();

function hashSession(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function equalHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function prune(now = Date.now()): void {
  for (const [handle, resource] of resources) {
    if (resource.expiresAt <= now) resources.delete(handle);
  }
  for (const [id, session] of providerSessions) {
    if (session.expiresAt <= now) providerSessions.delete(id);
  }
  if (resources.size >= MAX_RESOURCES) {
    const oldest = [...resources.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (const [handle] of oldest.slice(0, resources.size - MAX_RESOURCES + 1)) resources.delete(handle);
  }
}

export function bindProviderSession(providerSessionId: string, sessionToken: string): void {
  if (!providerSessionId || !/^[A-Za-z0-9-]{16,64}$/.test(providerSessionId)) throw new Error("Invalid provider session identifier");
  if (!/^[A-Za-z0-9_-]{43}$/.test(sessionToken)) throw new Error("Invalid playback session token");
  prune();
  const sessionHash = hashSession(sessionToken);
  const existing = providerSessions.get(providerSessionId);
  if (existing && !equalHash(existing.sessionHash, sessionHash)) throw new Error("Provider session is already bound to another playback session");
  providerSessions.set(providerSessionId, { sessionHash, expiresAt: Date.now() + RESOURCE_TTL_MS });
}

export function isProviderSessionBound(providerSessionId: string, sessionToken: string): boolean {
  prune();
  const session = providerSessions.get(providerSessionId);
  return Boolean(session && equalHash(session.sessionHash, hashSession(sessionToken)));
}

export function createPlaybackResourceHandle(input: PlaybackResourceInput): string {
  const streamHosts = anivexaStreamAllowedHosts();
  const providerHosts = anivexaAllowedHosts();
  if (!isAnivexaUrlAllowed(input.url, streamHosts)) throw new Error("Playback resource host is not allowlisted");
  if (input.referer && !isAnivexaUrlAllowed(input.referer, providerHosts) && !isAnivexaUrlAllowed(input.referer, streamHosts)) {
    throw new Error("Playback resource referer is not allowlisted");
  }
  bindProviderSession(input.providerSessionId, input.sessionToken);
  prune();
  const handle = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + RESOURCE_TTL_MS;
  resources.set(handle, {
    url: input.url,
    ...(input.referer ? { referer: input.referer } : {}),
    providerSessionId: input.providerSessionId,
    kind: input.kind ?? "auto",
    expiresAt,
    sessionHash: hashSession(input.sessionToken),
  });
  return handle;
}

export function resolvePlaybackResourceHandle(handle: string, sessionToken: string): PlaybackResource | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(handle) || !/^[A-Za-z0-9_-]{43}$/.test(sessionToken)) return null;
  prune();
  const stored = resources.get(handle);
  if (!stored || !equalHash(stored.sessionHash, hashSession(sessionToken))) return null;
  if (!isProviderSessionBound(stored.providerSessionId, sessionToken)) return null;
  const { sessionHash: _sessionHash, ...resource } = stored;
  return resource;
}

export function revokePlaybackResourcesForProviderSession(providerSessionId: string): void {
  providerSessions.delete(providerSessionId);
  for (const [handle, resource] of resources) {
    if (resource.providerSessionId === providerSessionId) resources.delete(handle);
  }
}

export function clearPlaybackResourceRegistryForTests(): void {
  resources.clear();
  providerSessions.clear();
}
