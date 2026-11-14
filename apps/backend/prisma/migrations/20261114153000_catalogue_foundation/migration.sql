CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AnimeType" AS ENUM ('TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL');
CREATE TYPE "ReleaseStatus" AS ENUM ('AIRING', 'FINISHED', 'NOT_YET_AIRED', 'CANCELLED');
CREATE TYPE "SeasonName" AS ENUM ('WINTER', 'SPRING', 'SUMMER', 'FALL');
CREATE TYPE "AgeRating" AS ENUM ('G', 'PG', 'PG_13', 'R', 'R_PLUS', 'RX');
CREATE TYPE "MediaKind" AS ENUM ('POSTER', 'BANNER', 'VIDEO', 'SUBTITLE');
CREATE TYPE "AssetProcessingState" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "SubtitleFormat" AS ENUM ('SRT', 'VTT', 'ASS');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL, "role" "UserRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserPreferences" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "theme" TEXT NOT NULL DEFAULT 'obsidian',
  "autoPlayNext" BOOLEAN NOT NULL DEFAULT true, "subtitleLang" TEXT NOT NULL DEFAULT 'en',
  CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Season" (
  "id" TEXT NOT NULL, "year" INTEGER NOT NULL, "season" "SeasonName" NOT NULL,
  "label" VARCHAR(100), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Season_year_season_key" ON "Season"("year", "season");
CREATE INDEX "Season_year_season_idx" ON "Season"("year", "season");

CREATE TABLE "Genre" (
  "id" TEXT NOT NULL, "slug" VARCHAR(100) NOT NULL, "name" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

CREATE TABLE "Studio" (
  "id" TEXT NOT NULL, "slug" VARCHAR(140) NOT NULL, "name" VARCHAR(160) NOT NULL,
  "description" TEXT, "website" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Studio_slug_key" ON "Studio"("slug");
CREATE UNIQUE INDEX "Studio_name_key" ON "Studio"("name");

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL, "storageKey" VARCHAR(500) NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL, "mediaKind" "MediaKind" NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL, "sizeBytes" BIGINT NOT NULL,
  "checksumSha256" VARCHAR(64), "processingState" "AssetProcessingState" NOT NULL DEFAULT 'PENDING',
  "width" INTEGER, "height" INTEGER, "durationSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE UNIQUE INDEX "MediaAsset_checksumSha256_key" ON "MediaAsset"("checksumSha256");
CREATE INDEX "MediaAsset_mediaKind_processingState_createdAt_idx"
  ON "MediaAsset"("mediaKind", "processingState", "createdAt");

CREATE TABLE "Anime" (
  "id" TEXT NOT NULL, "slug" VARCHAR(180) NOT NULL, "title" VARCHAR(240) NOT NULL,
  "englishTitle" VARCHAR(240), "nativeTitle" VARCHAR(240),
  "alternateTitles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "synopsis" TEXT, "type" "AnimeType" NOT NULL DEFAULT 'TV',
  "releaseStatus" "ReleaseStatus" NOT NULL DEFAULT 'FINISHED',
  "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "releaseYear" INTEGER, "releaseSeason" "SeasonName", "seasonGroupId" TEXT,
  "ageRating" "AgeRating", "score" INTEGER, "featured" BOOLEAN NOT NULL DEFAULT false,
  "posterAssetId" TEXT, "bannerAssetId" TEXT, "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Anime_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Anime_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  CONSTRAINT "Anime_releaseYear_check" CHECK ("releaseYear" IS NULL OR ("releaseYear" >= 1900 AND "releaseYear" <= 2200))
);
CREATE UNIQUE INDEX "Anime_slug_key" ON "Anime"("slug");
CREATE INDEX "Anime_publicationStatus_featured_updatedAt_idx"
  ON "Anime"("publicationStatus", "featured", "updatedAt");
CREATE INDEX "Anime_publicationStatus_releaseYear_releaseSeason_idx"
  ON "Anime"("publicationStatus", "releaseYear", "releaseSeason");
CREATE INDEX "Anime_publicationStatus_type_releaseStatus_idx"
  ON "Anime"("publicationStatus", "type", "releaseStatus");
CREATE INDEX "Anime_seasonGroupId_idx" ON "Anime"("seasonGroupId");
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_seasonGroupId_fkey"
  FOREIGN KEY ("seasonGroupId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_posterAssetId_fkey"
  FOREIGN KEY ("posterAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_bannerAssetId_fkey"
  FOREIGN KEY ("bannerAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Episode" (
  "id" TEXT NOT NULL, "animeId" TEXT NOT NULL, "seasonId" TEXT,
  "episodeNumber" INTEGER NOT NULL, "absoluteNumber" INTEGER,
  "title" VARCHAR(240) NOT NULL, "synopsis" TEXT, "durationSeconds" INTEGER,
  "airDate" TIMESTAMP(3), "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "isFiller" BOOLEAN NOT NULL DEFAULT false, "isRecap" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Episode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Episode_episodeNumber_check" CHECK ("episodeNumber" > 0),
  CONSTRAINT "Episode_durationSeconds_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0)
);
CREATE UNIQUE INDEX "Episode_animeId_episodeNumber_key" ON "Episode"("animeId", "episodeNumber");
CREATE INDEX "Episode_animeId_publicationStatus_episodeNumber_idx"
  ON "Episode"("animeId", "publicationStatus", "episodeNumber");
CREATE INDEX "Episode_seasonId_episodeNumber_idx" ON "Episode"("seasonId", "episodeNumber");
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_animeId_fkey"
  FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AnimeGenre" (
  "animeId" TEXT NOT NULL, "genreId" TEXT NOT NULL,
  CONSTRAINT "AnimeGenre_pkey" PRIMARY KEY ("animeId", "genreId")
);
CREATE INDEX "AnimeGenre_genreId_animeId_idx" ON "AnimeGenre"("genreId", "animeId");
ALTER TABLE "AnimeGenre" ADD CONSTRAINT "AnimeGenre_animeId_fkey"
  FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimeGenre" ADD CONSTRAINT "AnimeGenre_genreId_fkey"
  FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AnimeStudio" (
  "animeId" TEXT NOT NULL, "studioId" TEXT NOT NULL,
  CONSTRAINT "AnimeStudio_pkey" PRIMARY KEY ("animeId", "studioId")
);
CREATE INDEX "AnimeStudio_studioId_animeId_idx" ON "AnimeStudio"("studioId", "animeId");
ALTER TABLE "AnimeStudio" ADD CONSTRAINT "AnimeStudio_animeId_fkey"
  FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimeStudio" ADD CONSTRAINT "AnimeStudio_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EpisodeMedia" (
  "id" TEXT NOT NULL, "episodeId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
  "qualityLabel" VARCHAR(40), "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EpisodeMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EpisodeMedia_episodeId_assetId_key" ON "EpisodeMedia"("episodeId", "assetId");
CREATE INDEX "EpisodeMedia_episodeId_isDefault_idx" ON "EpisodeMedia"("episodeId", "isDefault");
ALTER TABLE "EpisodeMedia" ADD CONSTRAINT "EpisodeMedia_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpisodeMedia" ADD CONSTRAINT "EpisodeMedia_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubtitleTrack" (
  "id" TEXT NOT NULL, "episodeId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
  "languageCode" VARCHAR(16) NOT NULL, "label" VARCHAR(80) NOT NULL,
  "format" "SubtitleFormat" NOT NULL, "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubtitleTrack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubtitleTrack_episodeId_assetId_key" ON "SubtitleTrack"("episodeId", "assetId");
CREATE INDEX "SubtitleTrack_episodeId_languageCode_idx" ON "SubtitleTrack"("episodeId", "languageCode");
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubtitleTrack" ADD CONSTRAINT "SubtitleTrack_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
