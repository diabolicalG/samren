import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { CatalogListQuery } from "./catalog.schemas.js";

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
        ? [{ score: "desc" }, { title: "asc" }]
        : [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }];

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
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

export async function findPublishedAnimeBySlug(slug: string) {
  return prisma.anime.findFirst({
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
