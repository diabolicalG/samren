ALTER TABLE "Anime" ADD COLUMN "aniListId" INTEGER;
CREATE UNIQUE INDEX "Anime_aniListId_key" ON "Anime"("aniListId");
