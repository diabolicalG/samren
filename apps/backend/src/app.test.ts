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
