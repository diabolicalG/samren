import { z } from "zod";

const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const adminAnimeCreateSchema = z.object({
  slug: slugSchema.optional(),
  aniListId: z.number().int().positive().max(2_147_483_647).nullable().optional(),
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
  posterAssetId: z.string().cuid().nullable().optional(),
  bannerAssetId: z.string().cuid().nullable().optional(),
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

const safeStorageKeySchema = z.string().trim().min(1).max(500)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/)
  .refine((value) => !value.split("/").some((segment) => segment === "." || segment === ".."), "Storage key path traversal is not allowed");

export const adminAssetCreateSchema = z.object({
  storageKey: safeStorageKeySchema,
  originalFilename: z.string().trim().min(1).max(255).refine((value) => !value.includes("/") && !value.includes(String.fromCharCode(92)) && !value.includes(String.fromCharCode(0)), "Filename must not contain a path"),
  mediaKind: z.enum(["POSTER", "BANNER", "VIDEO", "SUBTITLE"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm", "text/vtt", "application/x-subrip", "application/x-ass"]),
  sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
  width: z.number().int().positive().max(30000).nullable().optional(),
  height: z.number().int().positive().max(30000).nullable().optional(),
  durationSeconds: z.number().int().positive().max(86400).nullable().optional(),
}).strict().superRefine((value, context) => {
  const allowedMime: Record<typeof value.mediaKind, string[]> = {
    POSTER: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    BANNER: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    VIDEO: ["video/mp4", "video/webm"],
    SUBTITLE: ["text/vtt", "application/x-subrip", "application/x-ass"],
  };
  if (!allowedMime[value.mediaKind].includes(value.mimeType)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["mimeType"], message: "MIME type does not match the selected media kind" });
  }
});

export const adminAssetUpdateSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255).refine((value) => !value.includes("/") && !value.includes(String.fromCharCode(92)) && !value.includes(String.fromCharCode(0)), "Filename must not contain a path").optional(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm", "text/vtt", "application/x-subrip", "application/x-ass"]).optional(),
  sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
  width: z.number().int().positive().max(30000).nullable().optional(),
  height: z.number().int().positive().max(30000).nullable().optional(),
  durationSeconds: z.number().int().positive().max(86400).nullable().optional(),
}).strict();

export const adminEpisodeMediaCreateSchema = z.object({
  assetId: z.string().cuid(),
  qualityLabel: z.string().trim().max(40).nullable().optional(),
  isDefault: z.boolean().default(false),
}).strict();

export const adminEpisodeMediaUpdateSchema = z.object({
  qualityLabel: z.string().trim().max(40).nullable().optional(),
  isDefault: z.boolean().optional(),
}).strict();

export const adminSubtitleTrackCreateSchema = z.object({
  assetId: z.string().cuid(),
  languageCode: z.string().trim().min(2).max(16).regex(/^[a-zA-Z0-9-]+$/),
  label: z.string().trim().min(1).max(80),
  format: z.enum(["SRT", "VTT", "ASS"]),
  isDefault: z.boolean().default(false),
}).strict();

export const adminSubtitleTrackUpdateSchema = z.object({
  languageCode: z.string().trim().min(2).max(16).regex(/^[a-zA-Z0-9-]+$/).optional(),
  label: z.string().trim().min(1).max(80).optional(),
  format: z.enum(["SRT", "VTT", "ASS"]).optional(),
  isDefault: z.boolean().optional(),
}).strict();
