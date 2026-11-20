import { Router, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { readStoredMediaStat } from "../media/storage.js";
import { catalogListQuerySchema, catalogSlugSchema } from "./catalog.schemas.js";
import {
  findPublishedAnimeBySlug,
  listPublishedAnime,
  listPublishedEpisodes,
  listPublishedGenres,
  listPublishedSeasons,
  listPublishedStudios,
} from "./catalog.service.js";

export const catalogRouter = Router();

function sendFailure(response: Response, error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    response.status(400).json({
      data: null,
      error: { code: "VALIDATION_ERROR", message: "The catalogue query is invalid" },
    });
    return;
  }
  response.status(500).json({
    data: null,
    error: { code: "INTERNAL_ERROR", message: "The catalogue request could not be completed" },
  });
}

async function isStoredAssetAvailable(storageKey: string, sizeBytes: bigint) {
  try {
    const stored = await readStoredMediaStat(storageKey);
    const expectedSize = Number(sizeBytes);
    return Boolean(stored && Number.isSafeInteger(expectedSize) && expectedSize > 0 && stored.sizeBytes === expectedSize);
  } catch {
    return false;
  }
}

catalogRouter.get("/anime", async (request, response) => {
  const parsed = catalogListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The catalogue query is invalid" } });
    return;
  }
  try {
    response.json({ data: await listPublishedAnime(parsed.data), error: null });
  } catch (error) {
    sendFailure(response, error);
  }
});

catalogRouter.get("/anime/:slug/episodes", async (request, response) => {
  const parsedSlug = catalogSlugSchema.safeParse(request.params.slug);
  if (!parsedSlug.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The anime slug is invalid" } });
    return;
  }
  try {
    const episodes = await listPublishedEpisodes(parsedSlug.data);
    if (!episodes) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Anime not found" } });
      return;
    }
    response.json({ data: episodes, error: null });
  } catch (error) {
    sendFailure(response, error);
  }
});

catalogRouter.get("/anime/:slug/episodes/:episodeNumber/playback", async (request, response) => {
  const parsedSlug = catalogSlugSchema.safeParse(request.params.slug);
  const episodeNumber = Number(request.params.episodeNumber);
  if (!parsedSlug.success || !Number.isSafeInteger(episodeNumber) || episodeNumber < 1) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The playback request is invalid" } });
    return;
  }

  try {
    const episode = await prisma.episode.findFirst({
      where: {
        episodeNumber,
        publicationStatus: "PUBLISHED",
        anime: { slug: parsedSlug.data, publicationStatus: "PUBLISHED" },
      },
      select: {
        id: true,
        episodeNumber: true,
        title: true,
        synopsis: true,
        durationSeconds: true,
        media: {
          where: { asset: { processingState: "READY", mediaKind: "VIDEO" } },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: {
            id: true, qualityLabel: true, isDefault: true,
            asset: { select: { id: true, mimeType: true, storageKey: true, sizeBytes: true } },
          },
        },
        subtitles: {
          where: { format: { in: ["VTT", "SRT"] }, asset: { processingState: "READY", mediaKind: "SUBTITLE" } },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: {
            id: true, languageCode: true, label: true, isDefault: true, format: true,
            asset: { select: { id: true, storageKey: true, sizeBytes: true } },
          },
        },
      },
    });
    if (!episode) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Episode not found" } });
      return;
    }

    const [mediaAvailability, subtitleAvailability] = await Promise.all([
      Promise.all(episode.media.map(async (item) => ({
        item,
        available: await isStoredAssetAvailable(item.asset.storageKey, item.asset.sizeBytes),
      }))),
      Promise.all(episode.subtitles.map(async (item) => ({
        item,
        available: await isStoredAssetAvailable(item.asset.storageKey, item.asset.sizeBytes),
      }))),
    ]);

    response.set("Cache-Control", "no-store").json({
      data: {
        episode: {
          id: episode.id,
          episodeNumber: episode.episodeNumber,
          title: episode.title,
          synopsis: episode.synopsis,
          durationSeconds: episode.durationSeconds,
        },
        sources: mediaAvailability
          .filter(({ available }) => available)
          .map(({ item }) => ({
            id: item.id,
            qualityLabel: item.qualityLabel,
            isDefault: item.isDefault,
            mimeType: item.asset.mimeType,
            url: `/api/v1/media/${item.asset.id}`,
          })),
        subtitles: subtitleAvailability
          .filter(({ available }) => available)
          .map(({ item }) => ({
            id: item.id,
            languageCode: item.languageCode,
            label: item.label,
            isDefault: item.isDefault,
            format: "VTT" as const,
            url: item.format === "SRT" ? `/api/v1/media/${item.asset.id}/vtt` : `/api/v1/media/${item.asset.id}`,
          })),
      },
      error: null,
    });
  } catch (error) {
    sendFailure(response, error);
  }
});

catalogRouter.get("/anime/:slug", async (request, response) => {
  const parsedSlug = catalogSlugSchema.safeParse(request.params.slug);
  if (!parsedSlug.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "The anime slug is invalid" } });
    return;
  }
  try {
    const anime = await findPublishedAnimeBySlug(parsedSlug.data);
    if (!anime) {
      response.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Anime not found" } });
      return;
    }
    response.json({ data: anime, error: null });
  } catch (error) {
    sendFailure(response, error);
  }
});

catalogRouter.get("/genres", async (_request, response) => {
  try {
    response.json({ data: await listPublishedGenres(), error: null });
  } catch (error) {
    sendFailure(response, error);
  }
});

catalogRouter.get("/studios", async (_request, response) => {
  try {
    response.json({ data: await listPublishedStudios(), error: null });
  } catch (error) {
    sendFailure(response, error);
  }
});

catalogRouter.get("/seasons", async (_request, response) => {
  try {
    response.json({ data: await listPublishedSeasons(), error: null });
  } catch (error) {
    sendFailure(response, error);
  }
});
