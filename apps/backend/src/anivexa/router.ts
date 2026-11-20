import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { getAnimeGGEpisodes } from "./animegg.js";
import { getAniZoneEpisodes } from "./anizone.js";
import { getAniKotoEpisodes } from "./anikoto.js";
import { getKaaEpisodes } from "./kaa.js";
import { providerAggregator } from "./aggregator.js";
import { proxyAnivexaMedia } from "./media-proxy.js";
import {
  getAniWavesEpisodes, getReAnimeEpisodes, getAnimeOnsenEpisodes,
  getAnimeNoSubEpisodes, getAniPmEpisodes, getSenshiEpisodes,
  getAnimeDunyaEpisodes,
} from "./legacy-adapters.js";

export const anivexaRouter = Router();

anivexaRouter.head("/media", proxyAnivexaMedia);
anivexaRouter.get("/media", proxyAnivexaMedia);

function clientMediaStream(stream: { url: string; type?: string; referer?: string; subtitles?: Array<{ url: string; [key: string]: unknown }>; [key: string]: unknown }) {
  const referer = stream.referer;
  const proxy = (url: string, kind?: string) => {
    const query = new URLSearchParams({ url });
    if (kind) query.set("kind", kind);
    if (referer) query.set("referer", referer);
    return `/api/v1/anivexa/media?${query.toString()}`;
  };
  const publicStream = { ...stream };
  delete publicStream.referer;
  return {
    ...publicStream,
    url: proxy(stream.url, stream.type),
    subtitles: stream.subtitles?.map((track) => ({ ...track, url: proxy(track.url, "vtt") })),
  };
}

const slugSchema = z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const providerSchema = z.enum(["animegg", "anizone", "anikoto", "kaa", "aniwaves", "reanime", "animeonsen", "animenosub", "anipm", "senshi", "animedunya"]);
const audioSchema = z.enum(["sub", "dub"]);
const episodeSchema = z.coerce.number().int().positive().max(10_000);
const fallbackBodySchema = z.object({ provider: providerSchema });

async function resolvePublishedAniListId(slug: string): Promise<number | null | "NOT_FOUND"> {
  const anime = await prisma.anime.findUnique({
    where: { slug },
    select: { aniListId: true, publicationStatus: true },
  });
  if (!anime || anime.publicationStatus !== "PUBLISHED") return "NOT_FOUND";
  return anime.aniListId;
}

function sendMappingError(response: import("express").Response, result: number | null | "NOT_FOUND"): boolean {
  if (result === "NOT_FOUND") {
    response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Published anime not found" } });
    return true;
  }
  if (result === null) {
    response.status(409).json({ data: null, error: { code: "ANILIST_MAPPING_REQUIRED", message: "This anime has no administrator-managed AniList mapping" } });
    return true;
  }
  return false;
}

anivexaRouter.get("/providers", (_request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  response.status(200).json({ data: { providers: providerAggregator.status.providers, status: "enabled" }, error: null });
});

anivexaRouter.get("/anime/:slug/episodes", async (request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  const slug = slugSchema.safeParse(request.params.slug);
  const provider = providerSchema.safeParse(request.query.provider ?? "animegg");
  if (!slug.success || !provider.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid catalogue slug and supported provider are required" } });
    return;
  }
  if (!env.ANIVEXA_ALLOWED_HOSTS.trim()) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_HOSTS_NOT_CONFIGURED", message: "Anivexa upstream hosts have not been allowlisted" } });
    return;
  }
  try {
    const aniListId = await resolvePublishedAniListId(slug.data);
    if (sendMappingError(response, aniListId)) return;
    const result = provider.data === "animegg"
      ? await getAnimeGGEpisodes(aniListId as number)
      : provider.data === "anizone"
        ? await getAniZoneEpisodes(aniListId as number)
        : provider.data === "anikoto"
          ? await getAniKotoEpisodes(aniListId as number)
          : provider.data === "kaa"
            ? await getKaaEpisodes(aniListId as number)
            : provider.data === "aniwaves"
              ? await getAniWavesEpisodes(aniListId as number)
              : provider.data === "reanime"
                ? await getReAnimeEpisodes(aniListId as number)
                : provider.data === "animeonsen"
                  ? await getAnimeOnsenEpisodes(aniListId as number)
                  : provider.data === "animenosub"
                    ? await getAnimeNoSubEpisodes(aniListId as number)
                    : provider.data === "anipm"
                      ? await getAniPmEpisodes(aniListId as number)
                      : provider.data === "senshi"
                        ? await getSenshiEpisodes(aniListId as number)
                        : await getAnimeDunyaEpisodes(aniListId as number);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: { slug: slug.data, provider: provider.data, ...result }, error: null });
  } catch {
    response.status(502).json({ data: null, error: { code: "ANIVEXA_UPSTREAM_FAILED", message: "Anivexa provider discovery is temporarily unavailable" } });
  }
});

anivexaRouter.get("/aggregate/providers", (_request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ data: providerAggregator.status, error: null });
});

anivexaRouter.get("/anime/:slug/episodes/:episodeNumber/aggregate", async (request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  const slug = slugSchema.safeParse(request.params.slug);
  const episode = episodeSchema.safeParse(request.params.episodeNumber);
  const audio = audioSchema.safeParse(request.query.audio ?? "sub");
  if (!slug.success || !episode.success || !audio.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid anime slug, episode number and audio type are required" } });
    return;
  }
  if (!env.ANIVEXA_ALLOWED_HOSTS.trim() || !env.ANIVEXA_STREAM_ALLOWED_HOSTS.trim()) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_HOSTS_NOT_CONFIGURED", message: "Anivexa upstream and stream hosts must both be allowlisted" } });
    return;
  }
  try {
    const aniListId = await resolvePublishedAniListId(slug.data);
    if (sendMappingError(response, aniListId)) return;
    const result = await providerAggregator.start(aniListId as number, episode.data, audio.data);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: { ...result, stream: clientMediaStream(result.stream) }, error: null });
  } catch {
    response.status(502).json({ data: null, error: { code: "ANIVEXA_ALL_PROVIDERS_FAILED", message: "No provider returned a valid playable stream" } });
  }
});

anivexaRouter.post("/aggregate/:sessionId/fallback", async (request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  const sessionId = z.string().uuid().safeParse(request.params.sessionId);
  const body = fallbackBodySchema.safeParse(request.body);
  if (!sessionId.success || !body.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid playback session and failed provider are required" } });
    return;
  }
  try {
    const result = await providerAggregator.fallback(sessionId.data, body.data.provider);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: { ...result, stream: clientMediaStream(result.stream) }, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notFound = message.includes("expired or was not found");
    response.status(notFound ? 404 : 409).json({
      data: null,
      error: { code: notFound ? "PLAYBACK_SESSION_EXPIRED" : "NO_FALLBACK_AVAILABLE", message: notFound ? "Playback session expired; start a new provider search" : "No alternate provider is currently available" },
    });
  }
});

anivexaRouter.delete("/aggregate/:sessionId", async (request, response) => {
  const sessionId = z.string().uuid().safeParse(request.params.sessionId);
  if (!sessionId.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid playback session is required" } });
    return;
  }
  await providerAggregator.close(sessionId.data);
  response.status(204).end();
});
