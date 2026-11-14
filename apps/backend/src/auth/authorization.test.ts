import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requireRole } from "./authorization.js";

describe("role authorization guard", () => {
  it("rejects requests without a verified principal", async () => {
    const app = express();
    app.post("/admin", requireRole("ADMIN"), (_request, response) => response.sendStatus(204));

    const response = await request(app).post("/admin");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects authenticated users without the required role", async () => {
    const app = express();
    app.use((request, _response, next) => {
      request.principal = { userId: "fixture-user", role: "USER" };
      next();
    });
    app.post("/admin", requireRole("ADMIN"), (_request, response) => response.sendStatus(204));

    const response = await request(app).post("/admin");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows a verified administrator", async () => {
    const app = express();
    app.use((request, _response, next) => {
      request.principal = { userId: "fixture-admin", role: "ADMIN" };
      next();
    });
    app.post("/admin", requireRole("ADMIN"), (_request, response) => response.sendStatus(204));

    const response = await request(app).post("/admin");
    expect(response.status).toBe(204);
  });
});
