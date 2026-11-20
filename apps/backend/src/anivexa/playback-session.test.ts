import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ensurePlaybackSession, readPlaybackSessionToken } from "./playback-session.js";

const app = express();
app.get("/create", (req, res) => res.json({ token: ensurePlaybackSession(req, res) }));
app.get("/verify", (req, res) => res.json({ token: readPlaybackSessionToken(req) }));

describe("playback session cookie", () => {
  it("creates an HttpOnly same-site cookie and accepts the signed token on later media requests", async () => {
    const agent = request.agent(app);
    const created = await agent.get("/create");
    expect(created.status).toBe(200);
    expect(created.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(created.headers["set-cookie"]?.[0]).toContain("SameSite=Strict");
    const verified = await agent.get("/verify");
    expect(verified.body.token).toBe(created.body.token);
  });

  it("rejects missing, malformed and tampered playback cookies", async () => {
    const missing = await request(app).get("/verify");
    const malformed = await request(app).get("/verify").set("Cookie", "samren_playback=not-a-token");
    const tampered = await request(app).get("/verify").set("Cookie", `samren_playback=${"a".repeat(43)}.invalid`);
    expect(missing.body.token).toBeNull();
    expect(malformed.body.token).toBeNull();
    expect(tampered.body.token).toBeNull();
  });
});
