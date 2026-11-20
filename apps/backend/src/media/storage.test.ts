import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const originalRoot = process.env.MEDIA_STORAGE_ROOT;
const originalNodeEnv = process.env.NODE_ENV;
let temporaryRoot = "";

afterEach(async () => {
  vi.resetModules();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
  else process.env.MEDIA_STORAGE_ROOT = originalRoot;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
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

  it("refuses to follow a symlink in place of a managed media file", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-file-link-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { createMediaStorageKey, resolveStoredMediaPath, openStoredMediaFile, readStoredMediaStat } = await import("./storage.js");
    const key = createMediaStorageKey();
    const destination = await resolveStoredMediaPath(key);
    const outside = path.join(temporaryRoot, "outside-secret.bin");
    await writeFile(outside, "must never be served");
    await symlink(outside, destination);

    expect(await openStoredMediaFile(key)).toBeNull();
    expect(await readStoredMediaStat(key)).toBeNull();
  });

  it("rejects a symlink used as a managed storage shard", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-shard-link-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { resolveStoredMediaPath } = await import("./storage.js");
    const outside = path.join(temporaryRoot, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(temporaryRoot, "aa"), "dir");

    await expect(resolveStoredMediaPath(`aa/${"b".repeat(32)}`)).rejects.toThrow("real directory");
  });

  it("requires an explicit absolute storage root in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.MEDIA_STORAGE_ROOT;
    vi.resetModules();
    await expect(import("../config/env.js")).rejects.toThrow(/MEDIA_STORAGE_ROOT.*absolute persistent path/);
  });

  it("rejects relative production storage roots", async () => {
    process.env.NODE_ENV = "production";
    process.env.MEDIA_STORAGE_ROOT = ".data/media";
    vi.resetModules();
    await expect(import("../config/env.js")).rejects.toThrow(/MEDIA_STORAGE_ROOT.*absolute persistent path/);
  });

  it("rejects production storage roots inside application public directories", async () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
    process.env.NODE_ENV = "production";
    process.env.MEDIA_STORAGE_ROOT = path.join(repoRoot, "apps", "frontend", "public", "media");
    vi.resetModules();
    await expect(import("../config/env.js")).rejects.toThrow(/outside public web roots/);
  });

  it("accepts an absolute production storage root", async () => {
    process.env.NODE_ENV = "production";
    process.env.MEDIA_STORAGE_ROOT = path.join(os.tmpdir(), "samren-media-prod");
    vi.resetModules();
    const { env } = await import("../config/env.js");
    expect(env.MEDIA_STORAGE_ROOT).toBe(path.join(os.tmpdir(), "samren-media-prod"));
  });

  it("lists only stale regular files with generated managed storage keys", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-orphans-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { listStaleManagedMediaKeys, storeMediaBuffer } = await import("./storage.js");
    const stale = await storeMediaBuffer(Buffer.from("stale media"));
    const fresh = await storeMediaBuffer(Buffer.from("fresh media"));
    const now = Date.now();
    await utimes(stale.absolutePath, new Date(now - 120_000), new Date(now - 120_000));

    const candidates = await listStaleManagedMediaKeys(60_000, now);
    expect(candidates).toEqual([stale.storageKey]);
    expect(candidates).not.toContain(fresh.storageKey);
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
    const { createMediaStorageKey, storeMediaStream } = await import("./storage.js");
    const bytes = Buffer.from("streamed-media-content");
    const reservedKey = createMediaStorageKey();
    const stored = await storeMediaStream(Readable.from([bytes.subarray(0, 5), bytes.subarray(5)]), 1024, reservedKey);
    expect(stored.storageKey).toBe(reservedKey);
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

describe("stale media temporary-file cleanup", () => {
  it("removes only old generated temp files and preserves fresh, unrelated, and symlink entries", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-cleanup-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { cleanupStaleMediaTempFiles, storeMediaBuffer } = await import("./storage.js");
    const stored = await storeMediaBuffer(Buffer.from("valid media"));
    const shard = path.dirname(stored.absolutePath);
    const now = Date.now();

    const stale = `${stored.absolutePath}.${"a".repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa.tmp`;
    const fresh = `${stored.absolutePath}.${"b".repeat(8)}-bbbb-4bbb-8bbb-bbbbbbbbbbbb.tmp`;
    const unrelated = path.join(shard, "operator-notes.tmp");
    const symlinkPath = `${stored.absolutePath}.${"c".repeat(8)}-cccc-4ccc-8ccc-cccccccccccc.tmp`;

    await writeFile(stale, "abandoned partial");
    await writeFile(fresh, "active partial");
    await writeFile(unrelated, "keep");
    await utimes(stale, new Date(now - 120_000), new Date(now - 120_000));
    await symlink(stale, symlinkPath);

    const removed = await cleanupStaleMediaTempFiles(60_000, now);
    expect(removed).toBe(1);
    await expect(readFile(stale)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(fresh, "utf8")).toBe("active partial");
    expect(await readFile(unrelated, "utf8")).toBe("keep");
    expect((await lstat(symlinkPath)).isSymbolicLink()).toBe(true);
    expect(await readFile(stored.absolutePath)).toEqual(Buffer.from("valid media"));
    expect(await readdir(shard)).toContain(path.basename(fresh));
  });

  it("rejects unsafe cleanup thresholds", async () => {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-cleanup-"));
    process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
    vi.resetModules();
    const { cleanupStaleMediaTempFiles } = await import("./storage.js");
    await expect(cleanupStaleMediaTempFiles(1)).rejects.toThrow("Invalid stale media cleanup parameters");
  });
});
