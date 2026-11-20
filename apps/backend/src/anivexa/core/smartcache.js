const entries = new Map();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const _CACHE_ENABLED = true;
export const WATCH_TTL = 3 * HOUR;
export const SHOW_IDENTITY_TTL = 24 * HOUR;
export const THIRTY_DAYS = 30 * DAY;

export function get(key) {
  const entry = entries.get(key);
  if (!entry || !isFresh(entry)) {
    entries.delete(key);
    return null;
  }
  return entry;
}

export function set(key, data, ttlMs, refreshAfterMs) {
  const now = Date.now();
  const entry = { data, cachedAt: now, ttl: ttlMs, refreshAfter: refreshAfterMs ?? ttlMs, expiresAt: now + ttlMs };
  entries.set(key, entry);
  return entry;
}

export function isFresh(entry) {
  return Boolean(entry) && Date.now() < entry.expiresAt;
}

export function needsRefresh(entry) {
  return !entry || Date.now() - entry.cachedAt > entry.refreshAfter;
}

export async function getAsync(key) {
  return get(key);
}

export async function setAsync(key, data, ttlMs, refreshAfterMs) {
  return set(key, data, ttlMs, refreshAfterMs);
}

export function del(key) {
  entries.delete(key);
}

export async function delAsync(key) {
  del(key);
}

export function delByPrefix(prefix) {
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

export async function delByPrefixAsync(prefix) {
  delByPrefix(prefix);
}

export function episodeTTL(status) {
  switch (status) {
    case "FINISHED": return [7 * DAY, Infinity];
    case "RELEASING": return [2 * HOUR, 15 * MIN];
    case "HIATUS": return [6 * HOUR, 60 * MIN];
    case "NOT_YET_RELEASED": return [30 * MIN, 15 * MIN];
    default: return [HOUR, 15 * MIN];
  }
}

export function mapTTL(status) {
  return status === "FINISHED" ? 30 * DAY : 12 * HOUR;
}
