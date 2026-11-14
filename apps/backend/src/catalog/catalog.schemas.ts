import { z } from "zod";

export const catalogListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]).optional(),
  status: z.enum(["AIRING", "FINISHED", "NOT_YET_AIRED", "CANCELLED"]).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  season: z.enum(["WINTER", "SPRING", "SUMMER", "FALL"]).optional(),
  genre: z.string().trim().min(1).max(100).optional(),
  studio: z.string().trim().min(1).max(140).optional(),
  featured: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sort: z.enum(["recent", "title", "score"]).default("recent"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;

export const catalogSlugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
