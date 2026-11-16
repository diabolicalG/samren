import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

const STORAGE_KEY_PATTERN = /^[a-f0-9]{2}[/][a-f0-9]{32}$/;
const MAX_BUFFER_BYTES = 50 * 1024 * 1024;

export type StoredMedia = {
  storageKey: string;
  absolutePath: string;
  sizeBytes: number;
  checksumSha256: string;
};

function configuredRoot() {
  return path.resolve(env.MEDIA_STORAGE_ROOT);
}

function assertStorageKey(storageKey: string) {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new Error("Invalid storage key");
  }
}

async function canonicalRoot() {
  const root = configuredRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const canonical = await realpath(root);
  const details = await stat(canonical);
  if (!details.isDirectory()) throw new Error("Media storage root is not a directory");
  return canonical;
}

export async function resolveStoredMediaPath(storageKey: string) {
  assertStorageKey(storageKey);
  const root = await canonicalRoot();
  const candidate = path.resolve(root, storageKey);
  if (!candidate.startsWith(root + path.sep)) throw new Error("Storage path escapes root");

  const parent = path.dirname(candidate);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const canonicalParent = await realpath(parent);
  if (canonicalParent !== root && !canonicalParent.startsWith(root + path.sep)) {
    throw new Error("Storage path escapes root");
  }
  return path.join(canonicalParent, path.basename(candidate));
}

export async function storeMediaBuffer(input: Buffer): Promise<StoredMedia> {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new Error("Media content must be a non-empty buffer");
  }
  if (input.length > MAX_BUFFER_BYTES) {
    throw new Error("Media content exceeds the in-memory storage limit");
  }

  const id = randomUUID().replace(/-/g, "");
  const storageKey = `${id.slice(0, 2)}/${id}`;
  const destination = await resolveStoredMediaPath(storageKey);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const checksumSha256 = createHash("sha256").update(input).digest("hex");
  let handle: Awaited<ReturnType<typeof open>> | undefined;

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

export async function deleteStoredMedia(storageKey: string) {
  const absolutePath = await resolveStoredMediaPath(storageKey);
  await rm(absolutePath, { force: true });
}

export async function readStoredMediaStat(storageKey: string) {
  const absolutePath = await resolveStoredMediaPath(storageKey);
  try {
    const details = await stat(absolutePath);
    if (!details.isFile()) return null;
    return { absolutePath, sizeBytes: details.size };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}
