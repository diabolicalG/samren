import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { prisma } from "../db/prisma.js";
import { getAnimeGGEpisodes } from "./animegg.js";
import { providerAggregator } from "./aggregator.js";
import { anivexaRouter } from "./router.js";

vi.mock("../config/env.js", () => ({
  env: {
    ANIVEXA_ENABLED: true,
    ANIVEXA_ALLOWED_HOSTS: "provider.test",
    ANIVEXA_STREAM_ALLOWED_HOSTS: "media.test",
  },
}));
vi.mock("../db/prisma.js", () => ({ prisma: { anime: { findUnique: vi.fn() } } }));
vi.mock("./animegg.js", () => ({ getAnimeGGEpisodes: vi.fn() }));
vi.mock("./anizone.js", () => ({ getAniZoneEpisodes: vi.fn() }));
vi.mock("./anikoto.js", () => ({ getAniKotoEpisodes: vi.fn() }));
vi.mock("./kaa.js", () => ({ getKaaEpisodes: vi.fn() }));
vi.mock("./legacy-adapters.js", () => ({
  getAniWavesEpisodes: vi.fn(), getReAnimeEpisodes: vi.fn(), getAnimeOnsenEpisodes: vi.fn(),
  getAnimeNoSubEpisodes: vi.fn(), getAniPmEpisodes: vi.fn(), getSenshiEpisodes: vi.fn(),
  getAnimeDunyaEpisodes: vi.fn(),
}));
vi.mock("./aggregator.js", () => ({
  providerAggregator: {
    status: { providers: [{ id: "animegg", name: "AnimeGG", state: "closed" }] },
    start: vi.fn(),
    fallback: vi.fn(),
    close: vi.fn(),
  },
}));
vi.mock("./media-proxy.js", () => ({ proxyAnivexaMedia: vi.fn((_request, response) => response.status(200).end()) }));

const app = express();
app.use(express.json());
app.use("/api/v1/anivexa", anivexaRouter);

afterEach(() => vi.clearAllMocks());

describe("Anivexa catalogue identity boundary", () => {
  it("resolves the AniList ID from a published Samren anime before provider episode discovery", async () => {
    vi.mocked(prisma.anime.findUnique).mockResolvedValue({ aniListId: 123456, publicationStatus: "PUBLISHED" } as never);
    vi.mocked(getAnimeGGEpisodes).mockResolvedValue({ episodes: [{ number: 1 }] } as never);

    const response = await request(app).get("/api/v1/anivexa/anime/clockwork-orbit/episodes");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ slug: "clockwork-orbit", provider: "animegg", episodes: [{ number: 1 }] });
    expect(prisma.anime.findUnique).toHaveBeenCalledWith({
      where: { slug: "clockwork-orbit" },
      select: { aniListId: true, publicationStatus: true },
    });
    expect(getAnimeGGEpisodes).toHaveBeenCalledWith(123456);
  });

  it("does not allow a viewer to supply an AniList ID when the local mapping is missing", async () => {
    vi.mocked(prisma.anime.findUnique).mockResolvedValue({ aniListId: null, publicationStatus: "PUBLISHED" } as never);
    const response = await request(app).get("/api/v1/anivexa/anime/clockwork-orbit/episodes");
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("ANILIST_MAPPING_REQUIRED");
    expect(getAnimeGGEpisodes).not.toHaveBeenCalled();
  });

  it("does not resolve provider episodes for unpublished or missing local anime", async () => {
    vi.mocked(prisma.anime.findUnique).mockResolvedValue(null);
    const response = await request(app).get("/api/v1/anivexa/anime/not-published/episodes");
    expect(response.status).toBe(404);
    expect(getAnimeGGEpisodes).not.toHaveBeenCalled();
  });

  it("uses the local AniList mapping for aggregate playback and removes raw-ID routes", async () => {
    vi.mocked(prisma.anime.findUnique).mockResolvedValue({ aniListId: 654321, publicationStatus: "PUBLISHED" } as never);
    vi.mocked(providerAggregator.start).mockResolvedValue({
      sessionId: "8f11a28a-3c6d-4b3b-b1fd-3d5e8b1f3f7a",
      stream: { provider: "animegg", url: "https://media.test/master.m3u8", type: "hls", server: "test", quality: "1080p", audio: "sub", referer: "https://provider.test/" },
      providers: 11,
      expiresAt: "2026-11-20T00:00:00.000Z",
    } as never);

    const response = await request(app).get("/api/v1/anivexa/anime/clockwork-orbit/episodes/2/aggregate");
    expect(response.status).toBe(200);
    expect(providerAggregator.start).toHaveBeenCalledWith(654321, 2, "sub");
    expect(response.body.data.stream.url).toContain("/api/v1/anivexa/media?url=");
    expect(response.body.data.stream).not.toHaveProperty("referer");

    const oldEpisodes = await request(app).get("/api/v1/anivexa/episodes/654321");
    const oldExtract = await request(app).get("/api/v1/anivexa/extract/654321/2");
    const oldAggregate = await request(app).get("/api/v1/anivexa/aggregate/654321/2");
    expect(oldEpisodes.status).toBe(404);
    expect(oldExtract.status).toBe(404);
    expect(oldAggregate.status).toBe(404);
  });
});
