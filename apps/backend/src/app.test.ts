import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("API foundation", () => {
  it("returns a timestamped health envelope", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.error).toBeNull();
    expect(response.body.data).toMatchObject({
      status: "ok",
      service: "samren-api",
    });
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false);
  });

  it("returns a consistent not-found envelope", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      data: null,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});

describe("public catalogue API", () => {
  it("returns only published catalogue records with stable pagination", async () => {
    const response = await request(app).get("/api/v1/catalog/anime?page=1&pageSize=1&sort=title");

    expect(response.status).toBe(200);
    expect(response.body.error).toBeNull();
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(response.body.data.pagination.totalItems).toBeGreaterThanOrEqual(3);
    expect(response.body.data.pagination.totalPages).toBe(response.body.data.pagination.totalItems);
    expect(response.body.data.items[0]).not.toHaveProperty("storageKey");
  });

  it("filters catalogue records by a local genre relation", async () => {
    const response = await request(app).get("/api/v1/catalog/anime?genre=adventure");

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.items.every((item: { genres: Array<{ genre: { slug: string } }> }) =>
      item.genres.some(({ genre }) => genre.slug === "adventure"),
    )).toBe(true);
  });

  it("returns published anime detail and its published episode list", async () => {
    const response = await request(app).get("/api/v1/catalog/anime/the-clockwork-orbit");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      slug: "the-clockwork-orbit",
      title: "The Clockwork Orbit",
      publicationStatus: "PUBLISHED",
    });
    expect(response.body.data).not.toHaveProperty("posterAsset.storageKey");
    expect(response.body.data.episodes).toEqual([]);
  });

  it("rejects invalid catalogue pagination", async () => {
    const response = await request(app).get("/api/v1/catalog/anime?pageSize=999");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not reveal unpublished or unknown catalogue records", async () => {
    const response = await request(app).get("/api/v1/catalog/anime/not-a-real-title");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

describe("first-party authentication boundaries", () => {
  it("does not expose session details to an unauthenticated request", async () => {
    const response = await request(app).get("/api/v1/auth/session");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("requires an allowed browser origin for login and logout", async () => {
    const rejectedLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.test", password: "not-a-real-password" });

    expect(rejectedLogin.status).toBe(403);
    expect(rejectedLogin.body.error.code).toBe("ORIGIN_NOT_ALLOWED");

    const rejectedLogout = await request(app).post("/api/v1/auth/logout");
    expect(rejectedLogout.status).toBe(403);
    expect(rejectedLogout.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("accepts the Vite development origin and validates login input", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .send({ email: "not-an-email", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("revokes a logout session and clears the HttpOnly cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^samren_session=;.*HttpOnly.*Max-Age=0/)]),
    );
  });
});
