import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const originalRoot = process.env.MEDIA_STORAGE_ROOT;
let temporaryRoot: string;

afterEach(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
  else process.env.MEDIA_STORAGE_ROOT = originalRoot;
});

describe("local media storage", () => {
  it("writes atomically under the configured root and returns a SHA-256 checksum", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    const { storeMediaBuffer } = await import("./storage.js");
    const bytes = Buffer.from("samren-media-test");
    const stored = await storeMediaBuffer(bytes);

    expect(stored.storageKey).toMatch(/^[a-f0-9]{2}\\/[a-f0-9]{32}$/);
    expect(stored.absolutePath.startsWith(await import("node:fs/promises").then((fs) => fs.realpath(temporaryRoot)))).toBe(true);
    expect(await readFile(stored.absolutePath)).toEqual(bytes);
    expect(stored.sizeBytes).toBe(bytes.length);
    expect(stored.checksumSha256).toBe("2ac3c7c0e2c4b8e4f9c4bcae15bb7c6d8f5aeb3e1a7fbbf0a4d5d7c9a4b0d8c0");
  });

  it("rejects traversal and malformed storage keys", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    const { resolveStoredMediaPath } = await import("./storage.js");
    await expect(resolveStoredMediaPath("../outside")).rejects.toThrow("Invalid storage key");
    await expect(resolveStoredMediaPath("ab/../../etc/passwd")).rejects.toThrow("Invalid storage key");
  });

  it("rejects empty and oversized buffers", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    const { storeMediaBuffer } = await import("./storage.js");
    await expect(storeMediaBuffer(Buffer.alloc(0))).rejects.toThrow("non-empty");
    await expect(storeMediaBuffer(Buffer.alloc(50 * 1024 * 1024 + 1))).rejects.toThrow("limit");
  });
});
