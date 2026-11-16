import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { readStoredMediaStat } from "./storage.js";
import { mediaRouter } from "./media.routes.js";

vi.mock("../db/prisma.js", () => ({
  prisma: { mediaAsset: { findFirst: vi.fn() } },
}));
vi.mock("./storage.js", () => ({
  readStoredMediaStat: vi.fn(),
}));

const app = express();
app.use("/media", mediaRouter);
let temporaryRoot = "";
let mediaPath = "";

const publishedAsset = {
  storageKey: "aa/00000000000000000000000000000000",
  mimeType: "video/mp4",
  checksumSha256: "a".repeat(64),
};

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-delivery-"));
  mediaPath = path.join(temporaryRoot, "sample.mp4");
  await writeFile(mediaPath, "0123456789");
  vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue(publishedAsset as never);
  vi.mocked(readStoredMediaStat).mockResolvedValue({ absolutePath: mediaPath, sizeBytes: 10 });
});

afterEach(async () => {
  vi.clearAllMocks();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

describe("public media delivery", () => {
  it("serves published ready media with safe headers", async () => {
    const response = await request(app).get("/media/asset-1");

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe("0123456789");
    expect(response.headers["content-type"]).toContain("video/mp4");
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers.etag).toBe(`"${publishedAsset.checksumSha256}"`);
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "asset-1",
        processingState: "READY",
        OR: expect.arrayContaining([
          expect.objectContaining({ episodeMedia: expect.any(Object) }),
        ]),
      }),
    }));
  });

  it("supports HEAD without returning the media body", async () => {
    const response = await request(app).head("/media/asset-1");

    expect(response.status).toBe(200);
    expect(response.headers["content-length"]).toBe("10");
    expect(response.text ?? "").toBe("");
  });

  it("serves a requested byte range and clamps the end to the file size", async () => {
    const response = await request(app).get("/media/asset-1").set("Range", "bytes=7-99");

    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 7-9/10");
    expect(response.body.toString()).toBe("789");
  });

  it("rejects malformed and unsatisfiable byte ranges", async () => {
    const malformed = await request(app).get("/media/asset-1").set("Range", "bytes=abc");
    const unsatisfiable = await request(app).get("/media/asset-1").set("Range", "bytes=10-");

    expect(malformed.status).toBe(416);
    expect(malformed.headers["content-range"]).toBe("bytes */10");
    expect(unsatisfiable.status).toBe(416);
  });

  it("does not deliver an asset that is not attached to published content", async () => {
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue(null);

    const response = await request(app).get("/media/unpublished");

    expect(response.status).toBe(404);
    expect(readStoredMediaStat).not.toHaveBeenCalled();
  });

  it("returns not found when the managed file is missing", async () => {
    vi.mocked(readStoredMediaStat).mockResolvedValue(null);

    const response = await request(app).get("/media/missing");

    expect(response.status).toBe(404);
  });
});
