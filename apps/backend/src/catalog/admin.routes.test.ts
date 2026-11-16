import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../auth/password.js";

const origin = "http://localhost:5173";
const adminEmail = "phase2-catalog-admin@samren.test";
const userEmail = "phase2-catalog-user@samren.test";
const adminPassword = "phase2-ci-catalog-admin-password";
const userPassword = "phase2-ci-catalog-user-password";
const animeSlug = "phase-two-admin-managed-title";
let adminId: string;
let userId: string;
let assetId: string | undefined;
const relatedAssetIds: string[] = [];

async function login(email: string, password: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/v1/auth/login").set("Origin", origin).send({ email, password });
  expect(response.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  const [adminHash, userHash] = await Promise.all([hashPassword(adminPassword), hashPassword(userPassword)]);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { username: "phase2-catalog-admin", passwordHash: adminHash, role: "ADMIN" },
    create: { email: adminEmail, username: "phase2-catalog-admin", passwordHash: adminHash, role: "ADMIN" },
    select: { id: true },
  });
  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: { username: "phase2-catalog-user", passwordHash: userHash, role: "USER" },
    create: { email: userEmail, username: "phase2-catalog-user", passwordHash: userHash, role: "USER" },
    select: { id: true },
  });
  adminId = admin.id;
  userId = user.id;
  await prisma.anime.deleteMany({ where: { slug: animeSlug } });
});

afterAll(async () => {
  await prisma.anime.deleteMany({ where: { slug: animeSlug } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: [assetId, ...relatedAssetIds].filter((id): id is string => Boolean(id)) } } });
  const userIds = [adminId, userId].filter((id): id is string => Boolean(id));
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("admin catalogue management", () => {
  it("rejects unauthenticated catalogue access", async () => {
    const response = await request(app).get("/api/v1/admin/catalog/anime");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects authenticated non-admin users", async () => {
    const agent = await login(userEmail, userPassword);
    const response = await agent.get("/api/v1/admin/catalog/anime");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("exposes full catalogue taxonomies only to administrators", async () => {
    const unauthenticated = await request(app).get("/api/v1/admin/catalog/genres");
    expect(unauthenticated.status).toBe(401);

    const agent = await login(adminEmail, adminPassword);
    const genres = await agent.get("/api/v1/admin/catalog/genres");
    const studios = await agent.get("/api/v1/admin/catalog/studios");
    const seasons = await agent.get("/api/v1/admin/catalog/seasons");
    expect(genres.status).toBe(200);
    expect(genres.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "adventure" })]));
    expect(studios.status).toBe(200);
    expect(studios.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "samren-studio-sample" })]));
    expect(seasons.status).toBe(200);
  });

  it("accepts a bounded first-party image upload only when its file signature matches", async () => {
    const agent = await login(adminEmail, adminPassword);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const uploaded = await agent
      .post("/api/v1/admin/catalog/assets/upload")
      .set("Origin", origin)
      .set("x-media-kind", "POSTER")
      .set("x-original-filename", "phase3-upload.png")
      .set("Content-Type", "image/png")
      .send(pngHeader);

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      originalFilename: "phase3-upload.png",
      mediaKind: "POSTER",
      mimeType: "image/png",
      sizeBytes: String(pngHeader.length),
      processingState: "READY",
    });
    assetId = uploaded.body.data.id as string;

    const mismatch = await agent
      .post("/api/v1/admin/catalog/assets/upload")
      .set("Origin", origin)
      .set("x-media-kind", "POSTER")
      .set("x-original-filename", "not-a-png.png")
      .set("Content-Type", "image/png")
      .send(Buffer.from("not an image"));

    expect(mismatch.status).toBe(415);
    expect(mismatch.body.error.code).toBe("FILE_SIGNATURE_MISMATCH");

    const removed = await agent.delete("/api/v1/admin/catalog/assets/" + assetId).set("Origin", origin);
    expect(removed.status).toBe(204);
    assetId = undefined;
  });

  it("accepts a bounded multipart upload with one signature-verified file", async () => {
    const agent = await login(adminEmail, adminPassword);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const uploaded = await agent
      .post("/api/v1/admin/catalog/assets/upload")
      .set("Origin", origin)
      .set("x-media-kind", "POSTER")
      .attach("file", pngHeader, { filename: "multipart-poster.png", contentType: "image/png" });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      originalFilename: "multipart-poster.png",
      mediaKind: "POSTER",
      mimeType: "image/png",
      sizeBytes: String(pngHeader.length),
      processingState: "READY",
    });
    const multipartAssetId = uploaded.body.data.id as string;
    const deleted = await agent.delete("/api/v1/admin/catalog/assets/" + multipartAssetId).set("Origin", origin);
    expect(deleted.status).toBe(204);
  });

  it("rejects multipart uploads with extra fields or multiple files", async () => {
    const agent = await login(adminEmail, adminPassword);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const extraField = await agent
      .post("/api/v1/admin/catalog/assets/upload")
      .set("Origin", origin)
      .set("x-media-kind", "POSTER")
      .field("unexpected", "not allowed")
      .attach("file", pngHeader, { filename: "extra-field.png", contentType: "image/png" });
    expect(extraField.status).toBe(400);

    const multipleFiles = await agent
      .post("/api/v1/admin/catalog/assets/upload")
      .set("Origin", origin)
      .set("x-media-kind", "POSTER")
      .attach("file", pngHeader, { filename: "first.png", contentType: "image/png" })
      .attach("second", pngHeader, { filename: "second.png", contentType: "image/png" });
    expect(multipleFiles.status).toBe(400);
  });

  it("creates, publishes, edits, and archives a first-party catalogue record", async () => {
    const agent = await login(adminEmail, adminPassword);
    const created = await agent
      .post("/api/v1/admin/catalog/anime")
      .set("Origin", origin)
      .send({
        slug: animeSlug,
        title: "Phase Two Admin Managed Title",
        publicationStatus: "DRAFT",
        genreSlugs: ["adventure"],
        studioSlugs: ["samren-studio-sample"],
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      slug: animeSlug,
      publicationStatus: "DRAFT",
      title: "Phase Two Admin Managed Title",
    });
    expect(created.body.data).not.toHaveProperty("posterAsset.storageKey");

    const asset = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin).send({
      storageKey: "samren/catalogue/posters/phase-two-test.webp",
      originalFilename: "phase-two-test.webp",
      mediaKind: "POSTER",
      mimeType: "image/webp",
      sizeBytes: 4096,
      width: 600,
      height: 800,
    });
    expect(asset.status).toBe(201);
    expect(asset.body.data.sizeBytes).toBe("4096");
    expect(asset.body.data.processingState).toBe("PENDING");
    const posterAssetId = asset.body.data.id as string;
    assetId = posterAssetId;
    relatedAssetIds.push(posterAssetId);

    const linked = await agent.patch("/api/v1/admin/catalog/anime/" + created.body.data.id)
      .set("Origin", origin).send({ posterAssetId });
    expect(linked.status).toBe(200);
    expect(linked.body.data.posterAssetId).toBe(posterAssetId);

    const episode = await agent.post("/api/v1/admin/catalog/episodes").set("Origin", origin).send({
      animeId: created.body.data.id,
      episodeNumber: 1,
      title: "A First-Party Pilot",
      publicationStatus: "PUBLISHED",
      durationSeconds: 1440,
    });
    expect(episode.status).toBe(201);
    expect(episode.body.data.title).toBe("A First-Party Pilot");

    const updatedEpisode = await agent.patch("/api/v1/admin/catalog/episodes/" + episode.body.data.id)
      .set("Origin", origin).send({ title: "The Edited Pilot", isRecap: true });
    expect(updatedEpisode.status).toBe(200);
    expect(updatedEpisode.body.data.title).toBe("The Edited Pilot");
    expect(updatedEpisode.body.data.isRecap).toBe(true);

    const videoAsset = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin).send({
      storageKey: "samren/assets/phase-two-episode.mp4",
      originalFilename: "phase-two-episode.mp4",
      mediaKind: "VIDEO",
      mimeType: "video/mp4",
      sizeBytes: 8192,
    });
    const subtitleAsset = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin).send({
      storageKey: "samren/assets/phase-two-episode.vtt",
      originalFilename: "phase-two-episode.vtt",
      mediaKind: "SUBTITLE",
      mimeType: "text/vtt",
      sizeBytes: 1024,
    });
    expect(videoAsset.status).toBe(201);
    expect(subtitleAsset.status).toBe(201);
    relatedAssetIds.push(videoAsset.body.data.id, subtitleAsset.body.data.id);

    const videoAssociation = await agent.post("/api/v1/admin/catalog/episodes/" + episode.body.data.id + "/media")
      .set("Origin", origin).send({ assetId: videoAsset.body.data.id, qualityLabel: "1080p", isDefault: true });
    expect(videoAssociation.status).toBe(201);
    expect(videoAssociation.body.data.isDefault).toBe(true);
    expect(videoAssociation.body.data.asset.mimeType).toBe("video/mp4");

    const subtitleAssociation = await agent.post("/api/v1/admin/catalog/episodes/" + episode.body.data.id + "/subtitles")
      .set("Origin", origin).send({ assetId: subtitleAsset.body.data.id, languageCode: "en", label: "English", format: "VTT", isDefault: true });
    expect(subtitleAssociation.status).toBe(201);
    expect(subtitleAssociation.body.data.asset.mimeType).toBe("text/vtt");

    const wrongMediaKind = await agent.post("/api/v1/admin/catalog/episodes/" + episode.body.data.id + "/media")
      .set("Origin", origin).send({ assetId: posterAssetId, qualityLabel: "poster" });
    expect(wrongMediaKind.status).toBe(400);
    expect(wrongMediaKind.body.error.code).toBe("INVALID_MEDIA_KIND");

    const updatedVideoAssociation = await agent.patch("/api/v1/admin/catalog/episode-media/" + videoAssociation.body.data.id)
      .set("Origin", origin).send({ qualityLabel: "720p" });
    expect(updatedVideoAssociation.status).toBe(200);
    expect(updatedVideoAssociation.body.data.qualityLabel).toBe("720p");

    const updatedSubtitleAssociation = await agent.patch("/api/v1/admin/catalog/subtitle-tracks/" + subtitleAssociation.body.data.id)
      .set("Origin", origin).send({ label: "English captions", isDefault: false });
    expect(updatedSubtitleAssociation.status).toBe(200);
    expect(updatedSubtitleAssociation.body.data.label).toBe("English captions");

    const draftPublicLookup = await request(app).get(`/api/v1/catalog/anime/${animeSlug}`);
    expect(draftPublicLookup.status).toBe(404);

    const published = await agent
      .patch(`/api/v1/admin/catalog/anime/${created.body.data.id}`)
      .set("Origin", origin)
      .send({ publicationStatus: "PUBLISHED", featured: true, title: "Phase Two Admin Edited Title", releaseYear: 2026 });
    expect(published.status).toBe(200);
    expect(published.body.data.publicationStatus).toBe("PUBLISHED");
    expect(published.body.data.featured).toBe(true);
    expect(published.body.data.title).toBe("Phase Two Admin Edited Title");
    expect(published.body.data.releaseYear).toBe(2026);

    const publicLookup = await request(app).get(`/api/v1/catalog/anime/${animeSlug}`);
    expect(publicLookup.status).toBe(200);
    expect(publicLookup.body.data.title).toBe("Phase Two Admin Edited Title");
    expect(publicLookup.body.data.posterAsset).toMatchObject({ id: posterAssetId, mimeType: "image/webp", width: 600, height: 800 });
    expect(publicLookup.body.data.posterAsset).not.toHaveProperty("storageKey");
    expect(publicLookup.body.data.episodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: episode.body.data.id, title: "The Edited Pilot" }),
    ]));

    const protectedAssetDelete = await agent.delete("/api/v1/admin/catalog/assets/" + posterAssetId).set("Origin", origin);
    expect(protectedAssetDelete.status).toBe(409);
    expect(protectedAssetDelete.body.error.code).toBe("IN_USE");

    const deletedVideoAssociation = await agent.delete("/api/v1/admin/catalog/episode-media/" + videoAssociation.body.data.id).set("Origin", origin);
    expect(deletedVideoAssociation.status).toBe(204);
    const deletedSubtitleAssociation = await agent.delete("/api/v1/admin/catalog/subtitle-tracks/" + subtitleAssociation.body.data.id).set("Origin", origin);
    expect(deletedSubtitleAssociation.status).toBe(204);

    const archivedEpisode = await agent.delete("/api/v1/admin/catalog/episodes/" + episode.body.data.id).set("Origin", origin);
    expect(archivedEpisode.status).toBe(200);
    expect(archivedEpisode.body.data.publicationStatus).toBe("ARCHIVED");

    const archived = await agent
      .delete(`/api/v1/admin/catalog/anime/${created.body.data.id}`)
      .set("Origin", origin);
    expect(archived.status).toBe(200);
    expect(archived.body.data.publicationStatus).toBe("ARCHIVED");

    const archivedPublicLookup = await request(app).get(`/api/v1/catalog/anime/${animeSlug}`);
    expect(archivedPublicLookup.status).toBe(404);
  });


  it("creates, updates, and safely deletes unused catalogue taxonomies", async () => {
    const agent = await login(adminEmail, adminPassword);
    const genre = await agent.post("/api/v1/admin/catalog/genres").set("Origin", origin).send({
      slug: "phase-two-test-genre",
      name: "Phase Two Test Genre",
    });
    expect(genre.status).toBe(201);
    const updatedGenre = await agent.patch("/api/v1/admin/catalog/genres/" + genre.body.data.id)
      .set("Origin", origin).send({ name: "Updated Phase Two Genre" });
    expect(updatedGenre.status).toBe(200);
    expect(updatedGenre.body.data.name).toBe("Updated Phase Two Genre");
    const deletedGenre = await agent.delete("/api/v1/admin/catalog/genres/" + genre.body.data.id).set("Origin", origin);
    expect(deletedGenre.status).toBe(204);

    const studio = await agent.post("/api/v1/admin/catalog/studios").set("Origin", origin).send({
      slug: "phase-two-test-studio",
      name: "Phase Two Test Studio",
      website: "https://example.invalid/studio",
    });
    expect(studio.status).toBe(201);
    const updatedStudio = await agent.patch("/api/v1/admin/catalog/studios/" + studio.body.data.id)
      .set("Origin", origin).send({ description: "A local test fixture." });
    expect(updatedStudio.status).toBe(200);
    expect(updatedStudio.body.data.description).toBe("A local test fixture.");
    const deletedStudio = await agent.delete("/api/v1/admin/catalog/studios/" + studio.body.data.id).set("Origin", origin);
    expect(deletedStudio.status).toBe(204);

    const season = await agent.post("/api/v1/admin/catalog/seasons").set("Origin", origin).send({
      year: 2028,
      season: "FALL",
      label: "Fall 2028 test",
    });
    expect(season.status).toBe(201);
    const updatedSeason = await agent.patch("/api/v1/admin/catalog/seasons/" + season.body.data.id)
      .set("Origin", origin).send({ label: "Updated Fall 2028" });
    expect(updatedSeason.status).toBe(200);
    expect(updatedSeason.body.data.label).toBe("Updated Fall 2028");
    const deletedSeason = await agent.delete("/api/v1/admin/catalog/seasons/" + season.body.data.id).set("Origin", origin);
    expect(deletedSeason.status).toBe(204);
  });

  it("prevents deleting a taxonomy that is in use", async () => {
    const agent = await login(adminEmail, adminPassword);
    const response = await agent.delete("/api/v1/admin/catalog/genres/" + (await prisma.genre.findUniqueOrThrow({ where: { slug: "adventure" }, select: { id: true } })).id)
      .set("Origin", origin);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("IN_USE");
  });


  it("rejects remote URLs, traversal paths and mismatched asset MIME types", async () => {
    const agent = await login(adminEmail, adminPassword);
    const base = {
      originalFilename: "unsafe.webp",
      mediaKind: "POSTER",
      mimeType: "image/webp",
      sizeBytes: 100,
    };
    const remote = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin)
      .send({ ...base, storageKey: "https://remote.invalid/poster.webp" });
    expect(remote.status).toBe(400);

    const traversal = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin)
      .send({ ...base, storageKey: "samren/../../outside.webp" });
    expect(traversal.status).toBe(400);

    const mismatched = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin)
      .send({ ...base, storageKey: "samren/assets/video-file.mp4", mediaKind: "VIDEO" });
    expect(mismatched.status).toBe(400);

    const valid = await agent.post("/api/v1/admin/catalog/assets").set("Origin", origin).send({
      storageKey: "samren/assets/test-video.mp4",
      originalFilename: "test-video.mp4",
      mediaKind: "VIDEO",
      mimeType: "video/mp4",
      sizeBytes: 2048,
    });
    expect(valid.status).toBe(201);
    const updated = await agent.patch("/api/v1/admin/catalog/assets/" + valid.body.data.id)
      .set("Origin", origin).send({ originalFilename: "renamed-test-video.mp4", sizeBytes: 4096 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.sizeBytes).toBe("4096");
    const deleted = await agent.delete("/api/v1/admin/catalog/assets/" + valid.body.data.id).set("Origin", origin);
    expect(deleted.status).toBe(204);
  });

  it("rejects mutations from an untrusted origin", async () => {
    const agent = await login(adminEmail, adminPassword);
    const response = await agent
      .post("/api/v1/admin/catalog/anime")
      .set("Origin", "https://attacker.invalid")
      .send({ title: "Should Not Be Created" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});
