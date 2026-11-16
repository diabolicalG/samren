import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { CatalogListQuery } from "./catalog.schemas.js";

function withMediaUrl<T extends { id: string }>(asset: T | null) {
  return asset ? { ...asset, url: `/api/v1/media/${asset.id}` } : null;
}

const animeCardInclude = {
  posterAsset: { select: { id: true, mimeType: true, width: true, height: true } },
  genres: { include: { genre: { select: { id: true, slug: true, name: true } } } },
} satisfies Prisma.AnimeInclude;

export async function listPublishedAnime(query: CatalogListQuery) {
  const where: Prisma.AnimeWhereInput = { publicationStatus: "PUBLISHED" };

  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { englishTitle: { contains: query.q, mode: "insensitive" } },
      { nativeTitle: { contains: query.q, mode: "insensitive" } },
      { alternateTitles: { has: query.q } },
    ];
  }
  if (query.type) where.type = query.type;
  if (query.status) where.releaseStatus = query.status;
  if (query.year) where.releaseYear = query.year;
  if (query.season) where.releaseSeason = query.season;
  if (query.featured !== undefined) where.featured = query.featured;
  if (query.genre) where.genres = { some: { genre: { slug: query.genre } } };
  if (query.studio) where.studios = { some: { studio: { slug: query.studio } } };

  const orderBy: Prisma.AnimeOrderByWithRelationInput[] =
    query.sort === "title"
      ? [{ title: "asc" }, { id: "asc" }]
      : query.sort === "score"
        ? [{ score: { sort: "desc", nulls: "last" } }, { title: "asc" }]
        : [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }];

  const skip = (query.page - 1) * query.pageSize;
  const [items, totalItems] = await Promise.all([
    prisma.anime.findMany({
      where,
      include: animeCardInclude,
      orderBy,
      skip,
      take: query.pageSize,
    }),
    prisma.anime.count({ where }),
  ]);

  return {
    items: items.map((item) => ({ ...item, posterAsset: withMediaUrl(item.posterAsset) })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

export async function findPublishedAnimeBySlug(slug: string) {
  const anime = await prisma.anime.findFirst({
    where: { slug, publicationStatus: "PUBLISHED" },
    include: {
      ...animeCardInclude,
      bannerAsset: { select: { id: true, mimeType: true, width: true, height: true } },
      studios: { include: { studio: { select: { id: true, slug: true, name: true } } } },
      seasonGroup: { select: { id: true, year: true, season: true, label: true } },
      episodes: {
        where: { publicationStatus: "PUBLISHED" },
        orderBy: [{ episodeNumber: "asc" }, { id: "asc" }],
        select: {
          id: true,
          episodeNumber: true,
          absoluteNumber: true,
          title: true,
          synopsis: true,
          durationSeconds: true,
          airDate: true,
          isFiller: true,
          isRecap: true,
        },
      },
    },
  });
  if (!anime) return null;
  return {
    ...anime,
    posterAsset: withMediaUrl(anime.posterAsset),
    bannerAsset: withMediaUrl(anime.bannerAsset),
  };
}

export async function listPublishedEpisodes(slug: string) {
  const anime = await prisma.anime.findFirst({
    where: { slug, publicationStatus: "PUBLISHED" },
    select: { id: true },
  });
  if (!anime) return null;

  return prisma.episode.findMany({
    where: { animeId: anime.id, publicationStatus: "PUBLISHED" },
    orderBy: [{ episodeNumber: "asc" }, { id: "asc" }],
    select: {
      id: true,
      episodeNumber: true,
      absoluteNumber: true,
      title: true,
      synopsis: true,
      durationSeconds: true,
      airDate: true,
      isFiller: true,
      isRecap: true,
    },
  });
}

export async function listPublishedGenres() {
  return prisma.genre.findMany({
    where: { anime: { some: { anime: { publicationStatus: "PUBLISHED" } } } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

export async function listPublishedStudios() {
  return prisma.studio.findMany({
    where: { anime: { some: { anime: { publicationStatus: "PUBLISHED" } } } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

export async function listPublishedSeasons() {
  return prisma.season.findMany({
    where: { anime: { some: { publicationStatus: "PUBLISHED" } } },
    orderBy: [{ year: "desc" }, { season: "desc" }],
    select: { id: true, year: true, season: true, label: true },
  });
}

export async function findPublishedEpisodePlayback(episodeId: string) {
  const episode = await prisma.episode.findFirst({
    where: {
      id: episodeId,
      publicationStatus: "PUBLISHED",
      anime: { publicationStatus: "PUBLISHED" },
    },
    select: {
      id: true,
      episodeNumber: true,
      title: true,
      durationSeconds: true,
      anime: { select: { id: true, slug: true, title: true } },
      media: {
        where: { asset: { processingState: "READY", mediaKind: "VIDEO" } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          qualityLabel: true,
          isDefault: true,
          asset: { select: { id: true, mimeType: true, sizeBytes: true } },
        },
      },
      subtitles: {
        where: { asset: { processingState: "READY", mediaKind: "SUBTITLE" } },
        orderBy: [{ isDefault: "desc" }, { languageCode: "asc" }],
        select: {
          id: true, languageCode: true, label: true, format: true, isDefault: true,
          asset: { select: { id: true, mimeType: true } },
        },
      },
    },
  });
  if (!episode) return null;
  return {
    episode: {
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      durationSeconds: episode.durationSeconds,
    },
    anime: episode.anime,
    sources: episode.media.map((item) => ({
      id: item.id,
      url: `/api/v1/media/${item.asset.id}`,
      mimeType: item.asset.mimeType,
      sizeBytes: item.asset.sizeBytes.toString(),
      qualityLabel: item.qualityLabel,
      isDefault: item.isDefault,
    })),
    subtitles: episode.subtitles.map((item) => ({
      id: item.id,
      url: `/api/v1/media/${item.asset.id}`,
      languageCode: item.languageCode,
      label: item.label,
      format: item.format,
      mimeType: item.asset.mimeType,
      isDefault: item.isDefault,
    })),
  };
}
