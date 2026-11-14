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

  it("creates, publishes, and archives a first-party catalogue record", async () => {
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
      .send({ publicationStatus: "PUBLISHED", featured: true });
    expect(published.status).toBe(200);
    expect(published.body.data.publicationStatus).toBe("PUBLISHED");
    expect(published.body.data.featured).toBe(true);

    const publicLookup = await request(app).get(`/api/v1/catalog/anime/${animeSlug}`);
    expect(publicLookup.status).toBe(200);
    expect(publicLookup.body.data.title).toBe("Phase Two Admin Managed Title");

    const archived = await agent
      .delete(`/api/v1/admin/catalog/anime/${created.body.data.id}`)
      .set("Origin", origin);
    expect(archived.status).toBe(200);
    expect(archived.body.data.publicationStatus).toBe("ARCHIVED");

    const archivedPublicLookup = await request(app).get(`/api/v1/catalog/anime/${animeSlug}`);
    expect(archivedPublicLookup.status).toBe(404);
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
