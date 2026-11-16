import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getAnimeGGEpisodes } from "./animegg.js";

export const anivexaRouter = Router();

const paramsSchema = z.object({ anilistId: z.coerce.number().int().positive().max(2_147_483_647) });
const providerSchema = z.enum(["animegg"]);

anivexaRouter.get("/providers", (_request, response) => {
  if (!env.ANIVEXA_ENABLED) {
    response.status(503).json({ data: null, error: { code: "ANIVEXA_DISABLED", message: "Anivexa integration is disabled" } });
    return;
  }
  response.status(200).json({ data: { providers: ["animegg"], status: "enabled" }, error: null });
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
    const result = await getAnimeGGEpisodes(params.data.anilistId);
    response.setHeader("Cache-Control", "public, max-age=300");
    response.status(200).json({ data: { anilistId: params.data.anilistId, provider: provider.data, ...result }, error: null });
  } catch {
    response.status(502).json({ data: null, error: { code: "ANIVEXA_UPSTREAM_FAILED", message: "Anivexa provider discovery is temporarily unavailable" } });
  }
});
