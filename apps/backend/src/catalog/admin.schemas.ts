import { z } from "zod";

const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const adminAnimeCreateSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().trim().min(1).max(240),
  englishTitle: optionalText(240),
  nativeTitle: optionalText(240),
  alternateTitles: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  synopsis: optionalText(10000),
  type: z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]).default("TV"),
  releaseStatus: z.enum(["AIRING", "FINISHED", "NOT_YET_AIRED", "CANCELLED"]).default("FINISHED"),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  releaseYear: z.number().int().min(1900).max(2200).nullable().optional(),
  releaseSeason: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).nullable().optional(),
  ageRating: z.enum(["G", "PG", "PG_13", "R", "R_PLUS", "RX"]).nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  featured: z.boolean().default(false),
  seasonGroupId: z.string().cuid().nullable().optional(),
  genreSlugs: z.array(slugSchema.max(100)).max(20).default([]),
  studioSlugs: z.array(slugSchema.max(140)).max(20).default([]),
}).strict();

export const adminAnimeUpdateSchema = adminAnimeCreateSchema.partial().extend({
  alternateTitles: z.array(z.string().trim().min(1).max(240)).max(30).optional(),
  genreSlugs: z.array(slugSchema.max(100)).max(20).optional(),
  studioSlugs: z.array(slugSchema.max(140)).max(20).optional(),
}).strict();

export const adminAnimeIdSchema = z.string().cuid();

const taxonomySlugSchema = z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const adminGenreCreateSchema = z.object({
  slug: taxonomySlugSchema.max(100),
  name: z.string().trim().min(1).max(100),
}).strict();

export const adminGenreUpdateSchema = adminGenreCreateSchema.partial().strict();

export const adminStudioCreateSchema = z.object({
  slug: taxonomySlugSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
}).strict();

export const adminStudioUpdateSchema = adminStudioCreateSchema.partial().strict();

export const adminSeasonCreateSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]),
  label: z.string().trim().max(100).nullable().optional(),
}).strict();

export const adminSeasonUpdateSchema = adminSeasonCreateSchema.partial().strict();

export const adminEpisodeCreateSchema = z.object({
  animeId: z.string().cuid(),
  seasonId: z.string().cuid().nullable().optional(),
  episodeNumber: z.number().int().positive().max(10000),
  absoluteNumber: z.number().int().positive().max(100000).nullable().optional(),
  title: z.string().trim().min(1).max(240),
  synopsis: optionalText(10000),
  durationSeconds: z.number().int().positive().max(86400).nullable().optional(),
  airDate: z.string().datetime().nullable().optional(),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  isFiller: z.boolean().default(false),
  isRecap: z.boolean().default(false),
}).strict();

export const adminEpisodeUpdateSchema = adminEpisodeCreateSchema.omit({ animeId: true }).partial().strict();
