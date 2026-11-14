import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "./password.js";

const email = "phase2-admin@samren.test";
const username = "phase2-admin";
const origin = "http://localhost:5173";
let userId: string;

beforeAll(async () => {
  const passwordHash = await hashPassword("phase2-ci-admin-password-2026");
  const user = await prisma.user.upsert({
    where: { email },
    update: { username, passwordHash, role: "ADMIN" },
    create: { email, username, passwordHash, role: "ADMIN" },
    select: { id: true },
  });
  userId = user.id;
});

afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
});

describe("first-party authentication sessions", () => {
  it("does not expose a session when no cookie is present", async () => {
    const response = await request(app).get("/api/v1/auth/session");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects login from an untrusted origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://attacker.invalid")
      .send({ email, password: "phase2-ci-admin-password-2026" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("creates a hashed server-side session and an HttpOnly cookie", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: "phase2-ci-admin-password-2026" });

    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ email, username, role: "ADMIN" });
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(login.headers["set-cookie"][0]).toContain("SameSite=Strict");
    expect(login.headers["set-cookie"][0]).toContain("Path=/api/v1");

    const session = await agent.get("/api/v1/auth/session");
    expect(session.status).toBe(200);
    expect(session.body.data.user).toMatchObject({ email, role: "ADMIN" });
  });

  it("rejects incorrect credentials without revealing account existence", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: "incorrect-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.body.error.message).toBe("Email or password is incorrect");
  });

  it("revokes the session on logout", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email, password: "phase2-ci-admin-password-2026" });

    const logout = await agent.post("/api/v1/auth/logout").set("Origin", origin);
    expect(logout.status).toBe(204);

    const session = await agent.get("/api/v1/auth/session");
    expect(session.status).toBe(401);
  });
});
