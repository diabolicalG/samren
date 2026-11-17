import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getAnimeGGEpisodes, getAnimeGGStreams } from "./animegg.js";
import { getAniZoneEpisodes, getAniZoneStreams } from "./anizone.js";
import { getAniKotoEpisodes, getAniKotoStreams } from "./anikoto.js";
import { getKaaEpisodes, getKaaStreams } from "./kaa.js";
import { providerAggregator } from "./aggregator.js";
import { proxyAnivexaMedia } from "./media-proxy.js";
import { getAniWavesEpisodes, getReAnimeEpisodes, getAnimeOnsenEpisodes, getAnimeNoSubEpisodes, getAniWavesStreams, getReAnimeStreams, getAnimeOnsenStreams, getAnimeNoSubStreams, getAniPmEpisodes, getSenshiEpisodes, getAniPmStreams, getSenshiStreams, getAnimeDunyaEpisodes, getAnimeDunyaStreams } from "./legacy-adapters.js";

export const anivexaRouter = Router();

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
  return { ...publicStream, url: proxy(stream.url, stream.type), subtitles: stream.subtitles?.map((track) => ({ ...track, url: proxy(track.url, "vtt") })) };
}

const paramsSchema = z.object({ anilistId: z.coerce.number().int().positive().max(2_147_483_647) });
const providerSchema = z.enum(["animegg", "anizone", "anikoto", "kaa", "aniwaves", "reanime", "animeonsen", "animenosub", "anipm", "senshi", "animedunya"]);

anivexaRouter.get("/providers", (_request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  response.status(200).json({ data: { providers: ["animegg", "anizone", "anikoto", "kaa", "aniwaves", "reanime", "animeonsen", "animenosub", "anipm", "senshi", "animedunya"], status: "enabled" }, error: null });
});

anivexaRouter.get("/episodes/:anilistId", async (request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  const params = paramsSchema.safeParse(request.params);
  const provider = providerSchema.safeParse(request.query.provider ?? "animegg");
  if (!params.success || !provider.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid AniList ID and supported Anivexa provider are required" } });
    return;
  }
  if (!env.ANIVEXA_ALLOWED_HOSTS.trim()) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_HOSTS_NOT_CONFIGURED", message: "Anivexa upstream hosts have not been allowlisted" } });
    return;
  }
  try {
    const result = provider.data === "animegg"
      ? await getAnimeGGEpisodes(params.data.anilistId)
      : provider.data === "anizone"
        ? await getAniZoneEpisodes(params.data.anilistId)
        : provider.data === "anikoto"
          ? await getAniKotoEpisodes(params.data.anilistId)
          : provider.data === "kaa"
            ? await getKaaEpisodes(params.data.anilistId)
            : provider.data === "aniwaves"
              ? await getAniWavesEpisodes(params.data.anilistId)
              : provider.data === "reanime"
                ? await getReAnimeEpisodes(params.data.anilistId)
                : provider.data === "animeonsen"
                  ? await getAnimeOnsenEpisodes(params.data.anilistId)
                  : provider.data === "animenosub"
                  ? await getAnimeNoSubEpisodes(params.data.anilistId)
                  : provider.data === "anipm"
                    ? await getAniPmEpisodes(params.data.anilistId)
                    : provider.data === "senshi"
                      ? await getSenshiEpisodes(params.data.anilistId)
                      : await getAnimeDunyaEpisodes(params.data.anilistId);
    response.setHeader("Cache-Control", "public, max-age=300");
    response.status(200).json({ data: { anilistId: params.data.anilistId, provider: provider.data, ...result }, error: null });
  } catch {
    response.status(502).json({ data: null, error: { code: "ANIVEXA_UPSTREAM_FAILED", message: "Anivexa provider discovery is temporarily unavailable" } });
  }
});

const extractParamsSchema = z.object({
  anilistId: z.coerce.number().int().positive().max(2_147_483_647),
  episode: z.coerce.number().int().positive().max(10_000),
});
const audioSchema = z.enum(["sub", "dub"]);

anivexaRouter.get("/extract/:anilistId/:episode", async (request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  const params = extractParamsSchema.safeParse(request.params);
  const audio = audioSchema.safeParse(request.query.audio ?? "sub");
  const extractor = z.enum(["animegg", "anizone", "anikoto", "kaa", "aniwaves", "reanime", "animeonsen", "animenosub", "anipm", "senshi", "animedunya"]).safeParse(request.query.provider ?? "animegg");
  if (!params.success || !audio.success || !extractor.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid AniList ID, episode number, provider and audio type are required" } });
    return;
  }
  if (!env.ANIVEXA_ALLOWED_HOSTS.trim() || !env.ANIVEXA_STREAM_ALLOWED_HOSTS.trim()) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_HOSTS_NOT_CONFIGURED", message: "Anivexa upstream and stream hosts must both be allowlisted" } });
    return;
  }
  try {
    const result = extractor.data === "animegg"
      ? await getAnimeGGStreams(params.data.anilistId, params.data.episode, audio.data)
      : extractor.data === "anizone"
        ? await getAniZoneStreams(params.data.anilistId, params.data.episode, audio.data)
        : extractor.data === "anikoto"
          ? await getAniKotoStreams(params.data.anilistId, params.data.episode, audio.data)
          : extractor.data === "kaa"
            ? await getKaaStreams(params.data.anilistId, params.data.episode, audio.data)
            : extractor.data === "aniwaves"
              ? await getAniWavesStreams(params.data.anilistId, params.data.episode, audio.data)
              : extractor.data === "reanime"
                ? await getReAnimeStreams(params.data.anilistId, params.data.episode, audio.data)
                : extractor.data === "animeonsen"
                  ? await getAnimeOnsenStreams(params.data.anilistId, params.data.episode, audio.data)
                  : extractor.data === "animenosub"
                  ? await getAnimeNoSubStreams(params.data.anilistId, params.data.episode, audio.data)
                  : extractor.data === "anipm"
                    ? await getAniPmStreams(params.data.anilistId, params.data.episode, audio.data)
                    : extractor.data === "senshi"
                      ? await getSenshiStreams(params.data.anilistId, params.data.episode, audio.data)
                      : await getAnimeDunyaStreams(params.data.anilistId, params.data.episode, audio.data);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: result, error: null });
  } catch {
    response.status(502).json({ data: null, error: { code: "ANIVEXA_EXTRACTION_FAILED", message: "Anivexa stream extraction is temporarily unavailable" } });
  }
});


const aggregateParamsSchema = z.object({
  anilistId: z.coerce.number().int().positive().max(2_147_483_647),
  episode: z.coerce.number().int().positive().max(10_000),
});
const fallbackBodySchema = z.object({ provider: providerSchema });

anivexaRouter.get("/aggregate/providers", (_request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ data: providerAggregator.status, error: null });
});

anivexaRouter.get("/aggregate/:anilistId/:episode", async (request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  const params = aggregateParamsSchema.safeParse(request.params);
  const audio = audioSchema.safeParse(request.query.audio ?? "sub");
  if (!params.success || !audio.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid AniList ID, episode number and audio type are required" } });
    return;
  }
  if (!env.ANIVEXA_ALLOWED_HOSTS.trim() || !env.ANIVEXA_STREAM_ALLOWED_HOSTS.trim()) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_HOSTS_NOT_CONFIGURED", message: "Anivexa upstream and stream hosts must both be allowlisted" } });
    return;
  }
  try {
    const result = await providerAggregator.start(params.data.anilistId, params.data.episode, audio.data);
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
