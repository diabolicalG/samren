import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../auth/password.js";

const origin = "http://localhost:3000";
const adminEmail = "phase2-catalog-admin@samren.test";
const userEmail = "phase2-catalog-user@samren.test";
const adminPassword = "phase2-ci-catalog-admin-password";
const userPassword = "phase2-ci-catalog-user-password";
const animeSlug = "phase-two-admin-managed-title";
let adminId: string;
let userId: string;

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
