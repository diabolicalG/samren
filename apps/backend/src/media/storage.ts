import { createHash, randomUUID } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, realpath, rename, rm, stat, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env.js";

const STORAGE_KEY_PATTERN = /^[a-f0-9]{2}[/][a-f0-9]{32}$/;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;

export type StoredMedia = {
  storageKey: string;
  absolutePath: string;
  sizeBytes: number;
  checksumSha256: string;
};

export type OpenedStoredMedia = {
  absolutePath: string;
  sizeBytes: number;
  handle: FileHandle;
};

function configuredRoot() {
  return path.resolve(env.MEDIA_STORAGE_ROOT);
}

function isFsCode(error: unknown, code: string) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}

export function isManagedStorageKey(storageKey: string) {
  return STORAGE_KEY_PATTERN.test(storageKey);
}

function assertStorageKey(storageKey: string) {
  if (!isManagedStorageKey(storageKey)) throw new Error("Invalid storage key");
}

async function canonicalRoot() {
  const root = configuredRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const entry = await lstat(root);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new Error("Media storage root must be a real directory, not a symlink");
  }
  const canonical = await realpath(root);
  const details = await stat(canonical);
  if (!details.isDirectory()) throw new Error("Media storage root is not a directory");
  await chmod(canonical, 0o700);
  return canonical;
}

/** Resolve generated keys only. Read/delete callers do not create missing shards. */
export async function resolveStoredMediaPath(storageKey: string, createParent = true) {
  assertStorageKey(storageKey);
  const root = await canonicalRoot();
  const candidate = path.resolve(root, storageKey);
  if (!candidate.startsWith(root + path.sep)) throw new Error("Storage path escapes root");

  const parent = path.dirname(candidate);
  if (createParent) await mkdir(parent, { recursive: true, mode: 0o700 });

  let parentEntry;
  try {
    parentEntry = await lstat(parent);
  } catch (error) {
    if (!createParent && isFsCode(error, "ENOENT")) return candidate;
    throw error;
  }
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) {
    throw new Error("Storage parent must be a real directory");
  }

  const canonicalParent = await realpath(parent);
  if (canonicalParent !== root && !canonicalParent.startsWith(root + path.sep)) {
    throw new Error("Storage path escapes root");
  }
  if (createParent) await chmod(canonicalParent, 0o700);
  return path.join(canonicalParent, path.basename(candidate));
}

export async function openStoredMediaFile(storageKey: string): Promise<OpenedStoredMedia | null> {
  const absolutePath = await resolveStoredMediaPath(storageKey, false);
  let handle: FileHandle | null = null;
  try {
    const entry = await lstat(absolutePath);
    if (entry.isSymbolicLink() || !entry.isFile()) return null;

    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    handle = await open(absolutePath, constants.O_RDONLY | noFollow);
    const details = await handle.stat();
    if (!details.isFile()) {
      await handle.close();
      handle = null;
      return null;
    }
    const opened = { absolutePath, sizeBytes: details.size, handle };
    handle = null;
    return opened;
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    if (isFsCode(error, "ENOENT") || isFsCode(error, "ELOOP")) return null;
    throw error;
  }
}

export async function storeMediaBuffer(input: Buffer): Promise<StoredMedia> {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new Error("Media content must be a non-empty buffer");
  if (input.length > MAX_BUFFER_BYTES) throw new Error("Media content exceeds the in-memory storage limit");

  const id = randomUUID().replace(/-/g, "");
  const storageKey = `${id.slice(0, 2)}/${id}`;
  const destination = await resolveStoredMediaPath(storageKey);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const checksumSha256 = createHash("sha256").update(input).digest("hex");
  let handle: FileHandle | undefined;

  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await handle.writeFile(input);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, destination);
    return { storageKey, absolutePath: destination, sizeBytes: input.length, checksumSha256 };
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function createMediaStorageKey() {
  const id = randomUUID().replace(/-/g, "");
  return `${id.slice(0, 2)}/${id}`;
}

export async function storeMediaStream(source: Readable, maxBytes: number, storageKey = createMediaStorageKey()) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 * 1024 * 1024) {
    throw new Error("Invalid media stream size limit");
  }
  assertStorageKey(storageKey);
  const destination = await resolveStoredMediaPath(storageKey);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const hash = createHash("sha256");
  let sizeBytes = 0;
  let prefix = Buffer.alloc(0);

  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > maxBytes) {
        callback(new Error("Media upload exceeds the configured size limit"));
        return;
      }
      hash.update(chunk);
      if (prefix.length < 64) prefix = Buffer.concat([prefix, chunk.subarray(0, 64 - prefix.length)]);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(source, meter, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
    const handle = await open(temporary, constants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (sizeBytes === 0) throw new Error("Media content must not be empty");
    await rename(temporary, destination);
    return { storageKey, absolutePath: destination, sizeBytes, checksumSha256: hash.digest("hex"), signature: prefix };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteStoredMedia(storageKey: string) {
  const absolutePath = await resolveStoredMediaPath(storageKey, false);
  try {
    const details = await lstat(absolutePath);
    if (details.isSymbolicLink() || !details.isFile()) throw new Error("Stored media is not a regular managed file");
    await unlink(absolutePath);
  } catch (error) {
    if (isFsCode(error, "ENOENT")) return;
    throw error;
  }
}

export async function readStoredMediaStat(storageKey: string) {
  const stored = await openStoredMediaFile(storageKey);
  if (!stored) return null;
  try {
    return { absolutePath: stored.absolutePath, sizeBytes: stored.sizeBytes };
  } finally {
    await stored.handle.close().catch(() => undefined);
  }
}

export async function cleanupStaleMediaTempFiles(olderThanMs = 24 * 60 * 60 * 1000, now = Date.now()) {
  if (!Number.isSafeInteger(olderThanMs) || olderThanMs < 60_000 || !Number.isFinite(now)) {
    throw new Error("Invalid stale media cleanup parameters");
  }
  const root = await canonicalRoot();
  const cutoff = now - olderThanMs;
  let removed = 0;
  const shards = await readdir(root, { withFileTypes: true });

  for (const shard of shards) {
    if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue;
    const shardPath = path.join(root, shard.name);
    const shardEntry = await lstat(shardPath);
    if (shardEntry.isSymbolicLink() || !shardEntry.isDirectory()) continue;
    const canonicalShard = await realpath(shardPath);
    if (path.dirname(canonicalShard) !== root) continue;
    const entries = await readdir(canonicalShard, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/^[a-f0-9]{32}\.[a-f0-9-]{36}\.tmp$/i.test(entry.name)) continue;
      if (entry.name.slice(0, 2).toLowerCase() !== shard.name.toLowerCase()) continue;
      const candidate = path.join(canonicalShard, entry.name);
      const details = await lstat(candidate);
      if (!details.isFile() || details.isSymbolicLink() || details.mtimeMs > cutoff) continue;
      await unlink(candidate);
      removed += 1;
    }
  }
  return removed;
}

export async function listStaleManagedMediaKeys(olderThanMs = 24 * 60 * 60 * 1000, now = Date.now()) {
  if (!Number.isSafeInteger(olderThanMs) || olderThanMs < 60_000 || !Number.isFinite(now)) {
    throw new Error("Invalid orphan media scan parameters");
  }
  const root = await canonicalRoot();
  const cutoff = now - olderThanMs;
  const keys: string[] = [];
  const shards = await readdir(root, { withFileTypes: true });

  for (const shard of shards) {
    if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue;
    const shardPath = path.join(root, shard.name);
    const shardEntry = await lstat(shardPath);
    if (shardEntry.isSymbolicLink() || !shardEntry.isDirectory()) continue;
    const canonicalShard = await realpath(shardPath);
    if (path.dirname(canonicalShard) !== root) continue;
    const entries = await readdir(canonicalShard, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/^[a-f0-9]{32}$/.test(entry.name)) continue;
      if (entry.name.slice(0, 2) !== shard.name) continue;
      const candidate = path.join(canonicalShard, entry.name);
      const details = await lstat(candidate);
      if (!details.isFile() || details.isSymbolicLink() || details.mtimeMs > cutoff) continue;
      keys.push(`${shard.name}/${entry.name}`);
    }
  }
  return keys;
}
