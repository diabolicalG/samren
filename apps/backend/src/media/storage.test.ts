import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

const originalRoot = process.env.MEDIA_STORAGE_ROOT;
let temporaryRoot = "";

afterEach(async () => {
  vi.resetModules();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
  else process.env.MEDIA_STORAGE_ROOT = originalRoot;
  temporaryRoot = "";
});

describe("local media storage", () => {
  it("writes atomically under the configured root and returns a SHA-256 checksum", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    await chmod(temporaryRoot, 0o755);
    vi.resetModules();
    const { storeMediaBuffer } = await import("./storage.js");
    const bytes = Buffer.from("samren-media-test");
    const stored = await storeMediaBuffer(bytes);

    expect(stored.storageKey).toMatch(/^[a-f0-9]{2}[/][a-f0-9]{32}$/);
    expect(stored.absolutePath.startsWith(await import("node:fs/promises").then((fs) => fs.realpath(temporaryRoot)))).toBe(true);
    expect(await readFile(stored.absolutePath)).toEqual(bytes);
    expect(stored.sizeBytes).toBe(bytes.length);
    const { createHash } = await import("node:crypto");
    expect(stored.checksumSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect((await stat(temporaryRoot)).mode & 0o777).toBe(0o700);
    expect((await stat(path.dirname(stored.absolutePath))).mode & 0o777).toBe(0o700);
    expect((await stat(stored.absolutePath)).mode & 0o777).toBe(0o600);
  });

  it("rejects traversal and malformed storage keys", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { resolveStoredMediaPath } = await import("./storage.js");
    await expect(resolveStoredMediaPath("../outside")).rejects.toThrow("Invalid storage key");
    await expect(resolveStoredMediaPath("ab/../../etc/passwd")).rejects.toThrow("Invalid storage key");
  });

  it("rejects empty and oversized buffers", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { storeMediaBuffer } = await import("./storage.js");
    await expect(storeMediaBuffer(Buffer.alloc(0))).rejects.toThrow("non-empty");
    await expect(storeMediaBuffer(Buffer.alloc(50 * 1024 * 1024 + 1))).rejects.toThrow("limit");
  });

  it("streams content to disk with a byte limit and incremental checksum", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { storeMediaStream } = await import("./storage.js");
    const bytes = Buffer.from("streamed-media-content");
    const stored = await storeMediaStream(Readable.from([bytes.subarray(0, 5), bytes.subarray(5)]), 1024);
    expect(await readFile(stored.absolutePath)).toEqual(bytes);
    expect(stored.sizeBytes).toBe(bytes.length);
    expect(stored.signature).toEqual(bytes.subarray(0, 64));
    const { createHash } = await import("node:crypto");
    expect(stored.checksumSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("removes partial files when a streamed upload exceeds its limit", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { storeMediaStream } = await import("./storage.js");
    await expect(storeMediaStream(Readable.from([Buffer.from("too large")]), 3)).rejects.toThrow("size limit");
    const directories = await readdir(temporaryRoot);
    expect(directories).toHaveLength(1);
    const files = await readdir(path.join(temporaryRoot, directories[0]));
    expect(files).toHaveLength(0);
  });
});
