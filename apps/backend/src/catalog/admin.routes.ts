import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { deleteStoredMedia, isManagedStorageKey } from "../media/storage.js";
import { requireRole } from "../auth/authorization.js";
import { requireTrustedOrigin } from "../auth/session.js";
import {
  adminAnimeCreateSchema,
  adminAnimeIdSchema,
  adminAnimeUpdateSchema,
  adminGenreCreateSchema,
  adminGenreUpdateSchema,
  adminStudioCreateSchema,
  adminStudioUpdateSchema,
  adminSeasonCreateSchema,
  adminSeasonUpdateSchema,
  adminEpisodeCreateSchema,
  adminEpisodeUpdateSchema,
  adminAssetCreateSchema,
  adminAssetUpdateSchema,
  adminEpisodeMediaCreateSchema,
  adminEpisodeMediaUpdateSchema,
  adminSubtitleTrackCreateSchema,
  adminSubtitleTrackUpdateSchema,
} from "./admin.schemas.js";

export const adminCatalogRouter = Router();

const adminAnimeSelect = {
  id: true,
  slug: true,
  aniListId: true,
  title: true,
  englishTitle: true,
  nativeTitle: true,
  synopsis: true,
  type: true,
  releaseStatus: true,
  publicationStatus: true,
  releaseYear: true,
  releaseSeason: true,
  ageRating: true,
  score: true,
  featured: true,
  posterAssetId: true,
  bannerAssetId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  genres: { select: { genre: { select: { id: true, slug: true, name: true } } } },
  studios: { select: { studio: { select: { id: true, slug: true, name: true } } } },
  _count: { select: { episodes: true } },
} satisfies Prisma.AnimeSelect;

function slugify(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
}

function sendError(response: import("express").Response, error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "P2002") {
      response.status(409).json({ data: null, error: { code: "CONFLICT", message: "A catalogue record with one of those unique values already exists" } });
      return;
    }
    if (code === "P2025") {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The requested catalogue record was not found" } });
      return;
    }
    if (code === "P2003") {
      response.status(409).json({ data: null, error: { code: "RELATION_CONFLICT", message: "The selected catalogue relation is not valid for this record" } });
      return;
    }
  }
  response.status(500).json({ data: null, error: { code: "INTERNAL_ERROR", message: "The catalogue operation could not be completed" } });
}

async function validateRelations(genreSlugs: string[] | undefined, studioSlugs: string[] | undefined, seasonGroupId: string | null | undefined, posterAssetId?: string | null, bannerAssetId?: string | null) {
  if (genreSlugs?.length) {
    const found = await prisma.genre.findMany({ where: { slug: { in: genreSlugs } }, select: { slug: true } });
    if (found.length !== genreSlugs.length) return false;
  }
  if (studioSlugs?.length) {
    const found = await prisma.studio.findMany({ where: { slug: { in: studioSlugs } }, select: { slug: true } });
    if (found.length !== studioSlugs.length) return false;
  }
  if (seasonGroupId) {
    const season = await prisma.season.findUnique({ where: { id: seasonGroupId }, select: { id: true } });
    if (!season) return false;
  }
  if (posterAssetId) {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: posterAssetId }, select: { mediaKind: true } });
    if (!asset || asset.mediaKind !== "POSTER") return false;
  }
  if (bannerAssetId) {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: bannerAssetId }, select: { mediaKind: true } });
    if (!asset || asset.mediaKind !== "BANNER") return false;
  }
  return true;
}

adminCatalogRouter.use(requireRole("ADMIN"));



adminCatalogRouter.post("/genres", requireTrustedOrigin, async (request, response) => {
  const parsed = adminGenreCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The genre record is invalid" } });
    return;
  }
  try {
    const item = await prisma.genre.create({ data: parsed.data, select: { id: true, slug: true, name: true } });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/genres/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminGenreUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The genre update is invalid" } });
    return;
  }
  try {
    const item = await prisma.genre.update({ where: { id: id.data }, data: parsed.data, select: { id: true, slug: true, name: true } });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/genres/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The genre identifier is invalid" } });
    return;
  }
  try {
    if (await prisma.animeGenre.count({ where: { genreId: id.data } })) {
      response.status(409).json({ data: null, error: { code: "IN_USE", message: "Remove this genre from catalogue entries before deleting it" } });
      return;
    }
    await prisma.genre.delete({ where: { id: id.data } });
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.post("/studios", requireTrustedOrigin, async (request, response) => {
  const parsed = adminStudioCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The studio record is invalid" } });
    return;
  }
  try {
    const item = await prisma.studio.create({ data: parsed.data, select: { id: true, slug: true, name: true, description: true, website: true } });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/studios/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminStudioUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The studio update is invalid" } });
    return;
  }
  try {
    const item = await prisma.studio.update({ where: { id: id.data }, data: parsed.data, select: { id: true, slug: true, name: true, description: true, website: true } });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/studios/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The studio identifier is invalid" } });
    return;
  }
  try {
    if (await prisma.animeStudio.count({ where: { studioId: id.data } })) {
      response.status(409).json({ data: null, error: { code: "IN_USE", message: "Remove this studio from catalogue entries before deleting it" } });
      return;
    }
    await prisma.studio.delete({ where: { id: id.data } });
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.post("/seasons", requireTrustedOrigin, async (request, response) => {
  const parsed = adminSeasonCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The season record is invalid" } });
    return;
  }
  try {
    const item = await prisma.season.create({ data: parsed.data, select: { id: true, year: true, season: true, label: true } });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/seasons/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminSeasonUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The season update is invalid" } });
    return;
  }
  try {
    const item = await prisma.season.update({ where: { id: id.data }, data: parsed.data, select: { id: true, year: true, season: true, label: true } });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/seasons/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The season identifier is invalid" } });
    return;
  }
  try {
    const [animeCount, episodeCount] = await Promise.all([
      prisma.anime.count({ where: { seasonGroupId: id.data } }),
      prisma.episode.count({ where: { seasonId: id.data } }),
    ]);
    if (animeCount || episodeCount) {
      response.status(409).json({ data: null, error: { code: "IN_USE", message: "This season is assigned to catalogue entries or episodes" } });
      return;
    }
    await prisma.season.delete({ where: { id: id.data } });
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
});


const adminAssetSelect = {
  id: true, storageKey: true, originalFilename: true, mediaKind: true, mimeType: true,
  sizeBytes: true, checksumSha256: true, processingState: true, width: true,
  height: true, durationSeconds: true, createdAt: true, updatedAt: true,
} satisfies Prisma.MediaAssetSelect;

function serializeAdminAsset<T extends { sizeBytes: bigint }>(asset: T) {
  return { ...asset, sizeBytes: asset.sizeBytes.toString() };
}

adminCatalogRouter.get("/assets", async (_request, response, next) => {
  try {
    const items = await prisma.mediaAsset.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 200,
      select: adminAssetSelect,
    });
    response.json({ data: items.map(serializeAdminAsset), error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.post("/assets", requireTrustedOrigin, async (request, response) => {
  const parsed = adminAssetCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The media asset metadata is invalid" } });
    return;
  }
  try {
    const { sizeBytes, ...data } = parsed.data;
    const item = await prisma.mediaAsset.create({
      data: { ...data, sizeBytes: BigInt(sizeBytes) },
      select: adminAssetSelect,
    });
    response.status(201).json({ data: serializeAdminAsset(item), error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/assets/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminAssetUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The media asset update is invalid" } });
    return;
  }
  try {
    const existing = await prisma.mediaAsset.findUnique({ where: { id: id.data }, select: { mediaKind: true } });
    if (!existing) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The media asset was not found" } });
      return;
    }
    if (parsed.data.mimeType) {
      const allowedMime: Record<typeof existing.mediaKind, string[]> = {
        POSTER: ["image/jpeg", "image/png", "image/webp", "image/avif"],
        BANNER: ["image/jpeg", "image/png", "image/webp", "image/avif"],
        VIDEO: ["video/mp4", "video/webm"],
        SUBTITLE: ["text/vtt", "application/x-subrip", "application/x-ass"],
      };
      if (!allowedMime[existing.mediaKind].includes(parsed.data.mimeType)) {
        response.status(400).json({ data: null, error: { code: "INVALID_MEDIA_TYPE", message: "MIME type does not match the asset kind" } });
        return;
      }
    }
    const { sizeBytes, ...fields } = parsed.data;
    const item = await prisma.mediaAsset.update({
      where: { id: id.data },
      data: { ...fields, sizeBytes: sizeBytes === undefined ? undefined : BigInt(sizeBytes) },
      select: adminAssetSelect,
    });
    response.json({ data: serializeAdminAsset(item), error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/assets/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The media asset identifier is invalid" } });
    return;
  }
  try {
    const [posterCount, bannerCount, episodeMediaCount, subtitleCount] = await Promise.all([
      prisma.anime.count({ where: { posterAssetId: id.data } }),
      prisma.anime.count({ where: { bannerAssetId: id.data } }),
      prisma.episodeMedia.count({ where: { assetId: id.data } }),
      prisma.subtitleTrack.count({ where: { assetId: id.data } }),
    ]);
    if (posterCount || bannerCount || episodeMediaCount || subtitleCount) {
      response.status(409).json({ data: null, error: { code: "IN_USE", message: "This asset is attached to catalogue content and cannot be deleted" } });
      return;
    }
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: id.data },
      select: { storageKey: true },
    });
    if (!asset) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The media asset was not found" } });
      return;
    }
    await prisma.mediaAsset.delete({ where: { id: id.data } });
    if (isManagedStorageKey(asset.storageKey)) await deleteStoredMedia(asset.storageKey);
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.get("/genres", async (_request, response, next) => {
  try {
    const items = await prisma.genre.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true },
    });
    response.json({ data: items, error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.get("/studios", async (_request, response, next) => {
  try {
    const items = await prisma.studio.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true },
    });
    response.json({ data: items, error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.get("/seasons", async (_request, response, next) => {
  try {
    const items = await prisma.season.findMany({
      orderBy: [{ year: "desc" }, { season: "desc" }],
      select: { id: true, year: true, season: true, label: true },
    });
    response.json({ data: items, error: null });
  } catch (error) {
    next(error);
  }
});


adminCatalogRouter.get("/anime/:animeId/episodes", async (request, response, next) => {
  const animeId = adminAnimeIdSchema.safeParse(request.params.animeId);
  if (!animeId.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The anime identifier is invalid" } });
    return;
  }
  try {
    const items = await prisma.episode.findMany({
      where: { animeId: animeId.data },
      orderBy: [{ episodeNumber: "asc" }, { id: "asc" }],
      select: {
        id: true, animeId: true, seasonId: true, episodeNumber: true, absoluteNumber: true,
        title: true, synopsis: true, durationSeconds: true, airDate: true,
        publicationStatus: true, isFiller: true, isRecap: true, createdAt: true, updatedAt: true,
      },
    });
    response.json({ data: items, error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.post("/episodes", requireTrustedOrigin, async (request, response) => {
  const parsed = adminEpisodeCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode record is invalid" } });
    return;
  }
  try {
    const data = parsed.data;
    const anime = await prisma.anime.findUnique({ where: { id: data.animeId }, select: { id: true } });
    if (!anime) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The anime record was not found" } });
      return;
    }
    if (data.seasonId && !(await prisma.season.findUnique({ where: { id: data.seasonId }, select: { id: true } }))) {
      response.status(400).json({ data: null, error: { code: "INVALID_RELATION", message: "The selected season does not exist" } });
      return;
    }
    const { animeId, seasonId, airDate, ...fields } = data;
    const item = await prisma.episode.create({
      data: {
        ...fields,
        anime: { connect: { id: animeId } },
        season: seasonId ? { connect: { id: seasonId } } : undefined,
        airDate: airDate ? new Date(airDate) : null,
      },
      select: {
        id: true, animeId: true, seasonId: true, episodeNumber: true, absoluteNumber: true,
        title: true, synopsis: true, durationSeconds: true, airDate: true,
        publicationStatus: true, isFiller: true, isRecap: true, createdAt: true, updatedAt: true,
      },
    });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/episodes/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminEpisodeUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode update is invalid" } });
    return;
  }
  try {
    const data = parsed.data;
    if (data.seasonId) {
      const season = await prisma.season.findUnique({ where: { id: data.seasonId }, select: { id: true } });
      if (!season) {
        response.status(400).json({ data: null, error: { code: "INVALID_RELATION", message: "The selected season does not exist" } });
        return;
      }
    }
    const { seasonId, airDate, ...fields } = data;
    const item = await prisma.episode.update({
      where: { id: id.data },
      data: {
        ...fields,
        season: seasonId === undefined ? undefined : seasonId === null ? { disconnect: true } : { connect: { id: seasonId } },
        airDate: airDate === undefined ? undefined : airDate === null ? null : new Date(airDate),
      },
      select: {
        id: true, animeId: true, seasonId: true, episodeNumber: true, absoluteNumber: true,
        title: true, synopsis: true, durationSeconds: true, airDate: true,
        publicationStatus: true, isFiller: true, isRecap: true, createdAt: true, updatedAt: true,
      },
    });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/episodes/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode identifier is invalid" } });
    return;
  }
  try {
    const item = await prisma.episode.update({
      where: { id: id.data },
      data: { publicationStatus: "ARCHIVED" },
      select: { id: true, animeId: true, episodeNumber: true, publicationStatus: true },
    });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});


const episodeMediaSelect = {
  id: true, episodeId: true, assetId: true, qualityLabel: true, isDefault: true, createdAt: true,
  asset: { select: { id: true, originalFilename: true, mimeType: true, width: true, height: true, durationSeconds: true, processingState: true } },
} satisfies Prisma.EpisodeMediaSelect;

const subtitleTrackSelect = {
  id: true, episodeId: true, assetId: true, languageCode: true, label: true, format: true, isDefault: true, createdAt: true,
  asset: { select: { id: true, originalFilename: true, mimeType: true, processingState: true } },
} satisfies Prisma.SubtitleTrackSelect;

adminCatalogRouter.get("/episodes/:episodeId/media", async (request, response, next) => {
  const episodeId = adminAnimeIdSchema.safeParse(request.params.episodeId);
  if (!episodeId.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode identifier is invalid" } });
    return;
  }
  try {
    const items = await prisma.episodeMedia.findMany({ where: { episodeId: episodeId.data }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: episodeMediaSelect });
    response.json({ data: items, error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.post("/episodes/:episodeId/media", requireTrustedOrigin, async (request, response) => {
  const episodeId = adminAnimeIdSchema.safeParse(request.params.episodeId);
  const parsed = adminEpisodeMediaCreateSchema.safeParse(request.body);
  if (!episodeId.success || !parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode media association is invalid" } });
    return;
  }
  try {
    const [episode, asset] = await Promise.all([
      prisma.episode.findUnique({ where: { id: episodeId.data }, select: { id: true } }),
      prisma.mediaAsset.findUnique({ where: { id: parsed.data.assetId }, select: { id: true, mediaKind: true } }),
    ]);
    if (!episode || !asset) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The episode or media asset was not found" } });
      return;
    }
    if (asset.mediaKind !== "VIDEO") {
      response.status(400).json({ data: null, error: { code: "INVALID_MEDIA_KIND", message: "Episode media must reference a VIDEO asset" } });
      return;
    }
    const item = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) await tx.episodeMedia.updateMany({ where: { episodeId: episodeId.data, isDefault: true }, data: { isDefault: false } });
      return tx.episodeMedia.create({ data: { ...parsed.data, episodeId: episodeId.data }, select: episodeMediaSelect });
    });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/episode-media/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminEpisodeMediaUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode media update is invalid" } });
    return;
  }
  try {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.episodeMedia.findUnique({ where: { id: id.data }, select: { episodeId: true } });
      if (!existing) throw Object.assign(new Error("Episode media not found"), { code: "P2025" });
      if (parsed.data.isDefault) await tx.episodeMedia.updateMany({ where: { episodeId: existing.episodeId, isDefault: true, id: { not: id.data } }, data: { isDefault: false } });
      return tx.episodeMedia.update({ where: { id: id.data }, data: parsed.data, select: episodeMediaSelect });
    });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/episode-media/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode media identifier is invalid" } });
    return;
  }
  try {
    await prisma.episodeMedia.delete({ where: { id: id.data } });
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.get("/episodes/:episodeId/subtitles", async (request, response, next) => {
  const episodeId = adminAnimeIdSchema.safeParse(request.params.episodeId);
  if (!episodeId.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The episode identifier is invalid" } });
    return;
  }
  try {
    const items = await prisma.subtitleTrack.findMany({ where: { episodeId: episodeId.data }, orderBy: [{ isDefault: "desc" }, { languageCode: "asc" }], select: subtitleTrackSelect });
    response.json({ data: items, error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.post("/episodes/:episodeId/subtitles", requireTrustedOrigin, async (request, response) => {
  const episodeId = adminAnimeIdSchema.safeParse(request.params.episodeId);
  const parsed = adminSubtitleTrackCreateSchema.safeParse(request.body);
  if (!episodeId.success || !parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The subtitle track is invalid" } });
    return;
  }
  try {
    const [episode, asset] = await Promise.all([
      prisma.episode.findUnique({ where: { id: episodeId.data }, select: { id: true } }),
      prisma.mediaAsset.findUnique({ where: { id: parsed.data.assetId }, select: { id: true, mediaKind: true, mimeType: true } }),
    ]);
    if (!episode || !asset) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The episode or subtitle asset was not found" } });
      return;
    }
    const mimeByFormat = { SRT: "application/x-subrip", VTT: "text/vtt", ASS: "application/x-ass" };
    if (asset.mediaKind !== "SUBTITLE" || asset.mimeType !== mimeByFormat[parsed.data.format]) {
      response.status(400).json({ data: null, error: { code: "INVALID_SUBTITLE_ASSET", message: "Subtitle format must match a SUBTITLE asset MIME type" } });
      return;
    }
    const item = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) await tx.subtitleTrack.updateMany({ where: { episodeId: episodeId.data, isDefault: true }, data: { isDefault: false } });
      return tx.subtitleTrack.create({ data: { ...parsed.data, episodeId: episodeId.data }, select: subtitleTrackSelect });
    });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/subtitle-tracks/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminSubtitleTrackUpdateSchema.safeParse(request.body);
  if (!id.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The subtitle track update is invalid" } });
    return;
  }
  try {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.subtitleTrack.findUnique({ where: { id: id.data }, select: { episodeId: true, format: true, asset: { select: { mediaKind: true, mimeType: true } } } });
      if (!existing) throw Object.assign(new Error("Subtitle track not found"), { code: "P2025" });
      const nextFormat = parsed.data.format ?? existing.format;
      const mimeByFormat = { SRT: "application/x-subrip", VTT: "text/vtt", ASS: "application/x-ass" };
      if (existing.asset.mediaKind !== "SUBTITLE" || existing.asset.mimeType !== mimeByFormat[nextFormat]) {
        throw Object.assign(new Error("Subtitle format does not match its asset"), { code: "P2003" });
      }
      if (parsed.data.isDefault) await tx.subtitleTrack.updateMany({ where: { episodeId: existing.episodeId, isDefault: true, id: { not: id.data } }, data: { isDefault: false } });
      return tx.subtitleTrack.update({ where: { id: id.data }, data: parsed.data, select: subtitleTrackSelect });
    });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/subtitle-tracks/:id", requireTrustedOrigin, async (request, response) => {
  const id = adminAnimeIdSchema.safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The subtitle track identifier is invalid" } });
    return;
  }
  try {
    await prisma.subtitleTrack.delete({ where: { id: id.data } });
    response.status(204).end();
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.get("/anime", async (_request, response, next) => {
  try {
    const items = await prisma.anime.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: adminAnimeSelect,
    });
    response.json({ data: { items }, error: null });
  } catch (error) {
    next(error);
  }
});

adminCatalogRouter.post("/anime", requireTrustedOrigin, async (request, response) => {
  const parsed = adminAnimeCreateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The anime record is invalid" } });
    return;
  }

  try {
    const data = parsed.data;
    if (!(await validateRelations(data.genreSlugs, data.studioSlugs, data.seasonGroupId, data.posterAssetId, data.bannerAssetId))) {
      response.status(400).json({ data: null, error: { code: "INVALID_RELATION", message: "One or more selected genres, studios, or seasons do not exist" } });
      return;
    }

    const slug = data.slug ?? slugify(data.title);
    if (!slug) {
      response.status(400).json({ data: null, error: { code: "INVALID_SLUG", message: "A valid URL slug could not be generated from the title" } });
      return;
    }

    const item = await prisma.anime.create({
      data: {
        slug,
        aniListId: data.aniListId,
        title: data.title,
        englishTitle: data.englishTitle,
        nativeTitle: data.nativeTitle,
        alternateTitles: data.alternateTitles,
        synopsis: data.synopsis,
        type: data.type,
        releaseStatus: data.releaseStatus,
        publicationStatus: data.publicationStatus,
        releaseYear: data.releaseYear,
        releaseSeason: data.releaseSeason,
        ageRating: data.ageRating,
        score: data.score,
        featured: data.featured,
        posterAsset: data.posterAssetId ? { connect: { id: data.posterAssetId } } : undefined,
        bannerAsset: data.bannerAssetId ? { connect: { id: data.bannerAssetId } } : undefined,
        seasonGroup: data.seasonGroupId ? { connect: { id: data.seasonGroupId } } : undefined,
        publishedAt: data.publicationStatus === "PUBLISHED" ? new Date() : null,
        genres: { create: data.genreSlugs.map((genreSlug) => ({ genre: { connect: { slug: genreSlug } } })) },
        studios: { create: data.studioSlugs.map((studioSlug) => ({ studio: { connect: { slug: studioSlug } } })) },
      },
      select: adminAnimeSelect,
    });
    response.status(201).json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.patch("/anime/:id", requireTrustedOrigin, async (request, response) => {
  const parsedId = adminAnimeIdSchema.safeParse(request.params.id);
  const parsed = adminAnimeUpdateSchema.safeParse(request.body);
  if (!parsedId.success || !parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The anime update is invalid" } });
    return;
  }

  try {
    const data = parsed.data;
    if (!(await validateRelations(data.genreSlugs, data.studioSlugs, data.seasonGroupId))) {
      response.status(400).json({ data: null, error: { code: "INVALID_RELATION", message: "One or more selected genres, studios, or seasons do not exist" } });
      return;
    }
    const existing = await prisma.anime.findUnique({ where: { id: parsedId.data }, select: { id: true, publishedAt: true } });
    if (!existing) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "The anime record was not found" } });
      return;
    }

    const update: Prisma.AnimeUpdateInput = {
      slug: data.slug,
      aniListId: data.aniListId,
      title: data.title,
      englishTitle: data.englishTitle,
      nativeTitle: data.nativeTitle,
      alternateTitles: data.alternateTitles,
      synopsis: data.synopsis,
      type: data.type,
      releaseStatus: data.releaseStatus,
      publicationStatus: data.publicationStatus,
      releaseYear: data.releaseYear,
      releaseSeason: data.releaseSeason,
      ageRating: data.ageRating,
      score: data.score,
      featured: data.featured,
      posterAsset: data.posterAssetId === undefined ? undefined : data.posterAssetId === null ? { disconnect: true } : { connect: { id: data.posterAssetId } },
      bannerAsset: data.bannerAssetId === undefined ? undefined : data.bannerAssetId === null ? { disconnect: true } : { connect: { id: data.bannerAssetId } },
      seasonGroup: data.seasonGroupId === undefined ? undefined : data.seasonGroupId === null
        ? { disconnect: true }
        : { connect: { id: data.seasonGroupId } },
      publishedAt: data.publicationStatus === undefined
        ? undefined
        : data.publicationStatus === "PUBLISHED" ? existing.publishedAt ?? new Date() : null,
      genres: data.genreSlugs === undefined ? undefined : {
        deleteMany: {},
        create: data.genreSlugs.map((genreSlug) => ({ genre: { connect: { slug: genreSlug } } })),
      },
      studios: data.studioSlugs === undefined ? undefined : {
        deleteMany: {},
        create: data.studioSlugs.map((studioSlug) => ({ studio: { connect: { slug: studioSlug } } })),
      },
    };

    const item = await prisma.anime.update({
      where: { id: parsedId.data },
      data: update,
      select: adminAnimeSelect,
    });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});

adminCatalogRouter.delete("/anime/:id", requireTrustedOrigin, async (request, response) => {
  const parsedId = adminAnimeIdSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The anime identifier is invalid" } });
    return;
  }
  try {
    const item = await prisma.anime.update({
      where: { id: parsedId.data },
      data: { publicationStatus: "ARCHIVED", featured: false },
      select: { id: true, slug: true, publicationStatus: true },
    });
    response.json({ data: item, error: null });
  } catch (error) {
    sendError(response, error);
  }
});
