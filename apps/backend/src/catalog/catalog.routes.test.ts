import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { prisma } from "../db/prisma.js";
import { readStoredMediaStat } from "../media/storage.js";
import { catalogRouter } from "./catalog.routes.js";

vi.mock("../db/prisma.js", () => ({ prisma: { episode: { findFirst: vi.fn() } } }));
vi.mock("../media/storage.js", () => ({ readStoredMediaStat: vi.fn() }));
vi.mock("./catalog.service.js", () => ({
  findPublishedAnimeBySlug: vi.fn(),
  listPublishedAnime: vi.fn(),
  listPublishedEpisodes: vi.fn(),
  listPublishedGenres: vi.fn(),
  listPublishedSeasons: vi.fn(),
  listPublishedStudios: vi.fn(),
}));

const app = express();
app.use("/api/v1/catalog", catalogRouter);
const videoKey = `aa/${"a".repeat(32)}`;
const missingVideoKey = `bb/${"b".repeat(32)}`;
const vttKey = `cc/${"c".repeat(32)}`;
const mismatchedSrtKey = `dd/${"d".repeat(32)}`;

const playbackEpisode = {
  id: "episode-1",
  episodeNumber: 1,
  title: "Episode One",
  synopsis: "A test episode",
  durationSeconds: 1440,
  media: [
    { id: "episode-media-1", qualityLabel: "1080p", isDefault: true, asset: { id: "video-1", mimeType: "video/mp4", storageKey: videoKey, sizeBytes: 100n } },
    { id: "episode-media-2", qualityLabel: "720p", isDefault: false, asset: { id: "video-missing", mimeType: "video/mp4", storageKey: missingVideoKey, sizeBytes: 50n } },
  ],
  subtitles: [
    { id: "subtitle-1", languageCode: "en", label: "English", isDefault: true, format: "VTT", asset: { id: "subtitle-vtt", mimeType: "text/vtt", storageKey: vttKey, sizeBytes: 12n } },
    { id: "subtitle-2", languageCode: "ja", label: "Japanese", isDefault: false, format: "SRT", asset: { id: "subtitle-srt", mimeType: "application/x-subrip", storageKey: mismatchedSrtKey, sizeBytes: 14n } },
    { id: "subtitle-3", languageCode: "fr", label: "French", isDefault: false, format: "VTT", asset: { id: "subtitle-invalid-format", mimeType: "application/x-subrip", storageKey: `ee/${"e".repeat(32)}`, sizeBytes: 15n } },
  ],
};

afterEach(() => vi.clearAllMocks());

describe("catalogue playback metadata", () => {
  it("returns only attached, published, ready and physically available first-party media", async () => {
    vi.mocked(prisma.episode.findFirst).mockResolvedValue(playbackEpisode as never);
    vi.mocked(readStoredMediaStat).mockImplementation(async (storageKey) => {
      const sizes = new Map<string, number>([[videoKey, 100], [vttKey, 12], [mismatchedSrtKey, 13], [`ee/${"e".repeat(32)}`, 15]]);
      const sizeBytes = sizes.get(storageKey);
      return sizeBytes === undefined ? null : { absolutePath: "/private/samren-media/file", sizeBytes };
    });

    const response = await request(app).get("/api/v1/catalog/anime/demo/episodes/1/playback");

    expect(response.status).toBe(200);
    expect(response.body.data.sources).toEqual([{
      id: "episode-media-1",
      qualityLabel: "1080p",
      isDefault: true,
      mimeType: "video/mp4",
      url: "/api/v1/media/video-1",
    }]);
    expect(response.body.data.subtitles).toEqual([{
      id: "subtitle-1",
      languageCode: "en",
      label: "English",
      isDefault: true,
      format: "VTT",
      url: "/api/v1/media/subtitle-vtt",
    }]);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(response.body)).not.toContain("/private/");
    expect(JSON.stringify(response.body)).not.toContain("storageKey");
    expect(readStoredMediaStat).toHaveBeenCalledWith(videoKey);
    expect(readStoredMediaStat).toHaveBeenCalledWith(missingVideoKey);
    expect(readStoredMediaStat).toHaveBeenCalledWith(vttKey);
    expect(readStoredMediaStat).toHaveBeenCalledWith(mismatchedSrtKey);
    expect(prisma.episode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        episodeNumber: 1,
        publicationStatus: "PUBLISHED",
        anime: { slug: "demo", publicationStatus: "PUBLISHED" },
      },
      select: expect.objectContaining({
        media: expect.objectContaining({ where: { asset: { processingState: "READY", mediaKind: "VIDEO", mimeType: { in: ["video/mp4", "video/webm"] } } } }),
        subtitles: expect.objectContaining({
          where: { format: { in: ["VTT", "SRT"] }, asset: { processingState: "READY", mediaKind: "SUBTITLE", mimeType: { in: ["text/vtt", "application/x-subrip", "text/srt"] } } },
        }),
      }),
    }));
  });

  it("rejects invalid episode numbers before querying the database", async () => {
    const response = await request(app).get("/api/v1/catalog/anime/demo/episodes/0/playback");
    expect(response.status).toBe(400);
    expect(prisma.episode.findFirst).not.toHaveBeenCalled();
  });

  it("does not expose playback metadata for unpublished or missing episodes", async () => {
    vi.mocked(prisma.episode.findFirst).mockResolvedValue(null);
    const response = await request(app).get("/api/v1/catalog/anime/demo/episodes/1/playback");
    expect(response.status).toBe(404);
    expect(readStoredMediaStat).not.toHaveBeenCalled();
  });
});
