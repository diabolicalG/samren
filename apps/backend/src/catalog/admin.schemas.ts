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
