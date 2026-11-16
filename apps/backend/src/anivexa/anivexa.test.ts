import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { isAnivexaUrlAllowed } from "./http.js";

describe("Anivexa HTTP policy", () => {
  const allowed = new Set(["anilist.co", "animegg.org"]);

  it("accepts only HTTPS hosts in the explicit allowlist", () => {
    expect(isAnivexaUrlAllowed("https://graphql.anilist.co", allowed)).toBe(true);
    expect(isAnivexaUrlAllowed("https://www.animegg.org/search", allowed)).toBe(true);
    expect(isAnivexaUrlAllowed("http://www.animegg.org", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://animegg.org.attacker.invalid", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://user:pass@animegg.org", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://127.0.0.1", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://animegg.org", new Set())).toBe(false);
  });
});

describe("Anivexa API", () => {
  it("keeps Anivexa disabled unless explicitly enabled", async () => {
    const response = await request(app).get("/api/v1/anivexa/providers");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("ANIVEXA_DISABLED");
  });

  it("does not allow invalid provider IDs", async () => {
    const response = await request(app).get("/api/v1/anivexa/episodes/not-an-id");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("ANIVEXA_DISABLED");
  });
});
