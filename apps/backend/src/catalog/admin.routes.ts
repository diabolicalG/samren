import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
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
} from "./admin.schemas.js";

export const adminCatalogRouter = Router();

const adminAnimeSelect = {
  id: true,
  slug: true,
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
  }
  response.status(500).json({ data: null, error: { code: "INTERNAL_ERROR", message: "The catalogue operation could not be completed" } });
}

async function validateRelations(genreSlugs: string[] | undefined, studioSlugs: string[] | undefined, seasonGroupId: string | null | undefined) {
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
    if (!(await validateRelations(data.genreSlugs, data.studioSlugs, data.seasonGroupId))) {
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
