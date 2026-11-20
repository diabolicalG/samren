import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { constants } from "node:fs";
import { open, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "../db/prisma.js";
import { openStoredMediaFile } from "./storage.js";
import { mediaRouter } from "./media.routes.js";

vi.mock("../db/prisma.js", () => ({ prisma: { mediaAsset: { findFirst: vi.fn() } } }));
vi.mock("./storage.js", () => ({ openStoredMediaFile: vi.fn() }));

const app = express();
app.use("/media", mediaRouter);
let temporaryRoot = "";
let mediaPath = "";
const publishedAsset = {
  storageKey: "aa/00000000000000000000000000000000",
  mediaKind: "VIDEO",
  mimeType: "video/mp4",
  checksumSha256: "a".repeat(64),
  sizeBytes: 10n,
};

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "samren-media-delivery-"));
  mediaPath = path.join(temporaryRoot, "sample.mp4");
  await writeFile(mediaPath, "0123456789");
  vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue(publishedAsset as never);
  vi.mocked(openStoredMediaFile).mockImplementation(async () => {
    const handle = await open(mediaPath, constants.O_RDONLY);
    const details = await handle.stat();
    return { absolutePath: mediaPath, sizeBytes: details.size, handle };
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

describe("public media delivery", () => {
  it("serves published ready video media with safe headers and strict relation filters", async () => {
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
          expect.objectContaining({ mediaKind: "VIDEO", mimeType: { in: ["video/mp4", "video/webm"] }, episodeMedia: expect.any(Object) }),
        ]),
      }),
    }));
  });

  it("serves a published poster only through its poster relation and image MIME allowlist", async () => {
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      ...publishedAsset, mediaKind: "POSTER", mimeType: "image/webp",
    } as never);
    const response = await request(app).get("/media/poster-1");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ mediaKind: "POSTER", mimeType: { in: ["image/jpeg", "image/png", "image/webp", "image/avif"] }, posterFor: expect.any(Object) }),
        ]),
      }),
    }));
  });

  it("serves direct WebVTT subtitle assets through the generic media endpoint", async () => {
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      ...publishedAsset, mediaKind: "SUBTITLE", mimeType: "text/vtt",
    } as never);
    const response = await request(app).get("/media/subtitle-vtt");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/vtt");
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ mediaKind: "SUBTITLE", mimeType: "text/vtt", subtitleTracks: expect.any(Object) }),
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

  it("supports HEAD byte ranges without returning a body", async () => {
    const response = await request(app).head("/media/asset-1").set("Range", "bytes=2-4");
    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 2-4/10");
    expect(response.headers["content-length"]).toBe("3");
    expect(response.text ?? "").toBe("");
  });

  it("serves a requested byte range and clamps the end to the file size", async () => {
    const response = await request(app).get("/media/asset-1").set("Range", "bytes=7-99");
    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 7-9/10");
    expect(response.body.toString()).toBe("789");
  });

  it("clamps an oversized suffix range to the complete file", async () => {
    const response = await request(app).get("/media/asset-1").set("Range", "bytes=-999999999999999999999999999999");
    expect(response.status).toBe(206);
    expect(response.headers["content-range"]).toBe("bytes 0-9/10");
    expect(response.body.toString()).toBe("0123456789");
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
    expect(openStoredMediaFile).not.toHaveBeenCalled();
  });

  it("returns not found when the managed file is missing", async () => {
    vi.mocked(openStoredMediaFile).mockResolvedValue(null);
    const response = await request(app).get("/media/missing");
    expect(response.status).toBe(404);
  });

  it("does not serve a file whose size differs from database metadata", async () => {
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({ ...publishedAsset, sizeBytes: 11n } as never);
    const response = await request(app).get("/media/asset-size-mismatch");
    expect(response.status).toBe(404);
  });

  it("converts only a published subtitle asset into WebVTT", async () => {
    const subtitle = "1\n00:00:01,000 --> 00:00:02,500\nHello from Samren";
    await writeFile(mediaPath, subtitle);
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      ...publishedAsset, mediaKind: "SUBTITLE", mimeType: "application/x-subrip",
      sizeBytes: BigInt(Buffer.byteLength(subtitle)),
    } as never);
    const response = await request(app).get("/media/asset-1/vtt");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/vtt");
    expect(response.text).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello from Samren\n");
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ mediaKind: "SUBTITLE", processingState: "READY" }),
    }));
  });

  it("does not expose malformed SubRip content as a browser subtitle", async () => {
    await writeFile(mediaPath, "not a subtitle");
    vi.mocked(prisma.mediaAsset.findFirst).mockResolvedValue({
      ...publishedAsset, mediaKind: "SUBTITLE", mimeType: "application/x-subrip",
      sizeBytes: BigInt(Buffer.byteLength("not a subtitle")),
    } as never);
    const response = await request(app).get("/media/asset-1/vtt");
    expect(response.status).toBe(422);
  });
});
