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
      totalItems: 3,
      totalPages: 3,
    });
    expect(response.body.data.items[0]).not.toHaveProperty("storageKey");
  });

  it("filters catalogue records by a local genre relation", async () => {
    const response = await request(app).get("/api/v1/catalog/anime?genre=adventure");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
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
