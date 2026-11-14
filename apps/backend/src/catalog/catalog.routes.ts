import { Router } from "express";
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

function sendFailure(response: Parameters<Parameters<typeof catalogRouter.get>[1]>[1], error: unknown) {
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
