import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getAnimeGGEpisodes, getAnimeGGStreams } from "./animegg.js";
import { getAniZoneEpisodes } from "./anizone.js";

export const anivexaRouter = Router();

const paramsSchema = z.object({ anilistId: z.coerce.number().int().positive().max(2_147_483_647) });
const providerSchema = z.enum(["animegg", "anizone"]);

anivexaRouter.get("/providers", (_request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  response.status(200).json({ data: { providers: ["animegg", "anizone"], status: "enabled" }, error: null });
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
      : await getAniZoneEpisodes(params.data.anilistId);
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
  if (!params.success || !audio.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "A valid AniList ID, episode number and audio type are required" } });
    return;
  }
  if (!env.ANIVEXA_ALLOWED_HOSTS.trim() || !env.ANIVEXA_STREAM_ALLOWED_HOSTS.trim()) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_HOSTS_NOT_CONFIGURED", message: "Anivexa upstream and stream hosts must both be allowlisted" } });
    return;
  }
  try {
    const result = await getAnimeGGStreams(params.data.anilistId, params.data.episode, audio.data);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: result, error: null });
  } catch {
    response.status(502).json({ data: null, error: { code: "ANIVEXA_EXTRACTION_FAILED", message: "Anivexa stream extraction is temporarily unavailable" } });
  }
});
