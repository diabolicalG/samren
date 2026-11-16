import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { isAnivexaUrlAllowed } from "./http.js";
import { parseAniZoneEpisodes } from "./anizone.js";
import { parseAniKotoEpisodes, parseAniKotoSearchResults } from "./anikoto.js";

describe("Anivexa HTTP policy", () => {
  const allowed = new Set(["anilist.co", "animegg.org"]);

  it("accepts only HTTPS hosts in the explicit allowlist", () => {
    expect(isAnivexaUrlAllowed("https://graphql.anilist.co", allowed)).toBe(true);
    expect(isAnivexaUrlAllowed("https://www.animegg.org/search", allowed)).toBe(true);
    expect(isAnivexaUrlAllowed("https://anizone.to/anime", new Set(["anizone.to"]))).toBe(true);
    expect(isAnivexaUrlAllowed("http://www.animegg.org", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://animegg.org.attacker.invalid", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://user:pass@animegg.org", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://127.0.0.1", allowed)).toBe(false);
    expect(isAnivexaUrlAllowed("https://animegg.org", new Set())).toBe(false);
    expect(isAnivexaUrlAllowed("https://cdn.example-stream.net/video.m3u8", new Set(["example-stream.net"]))).toBe(true);
    expect(isAnivexaUrlAllowed("https://untrusted.invalid/video.m3u8", new Set(["example-stream.net"]))).toBe(false);
  });
});

describe("AniZone episode payload parsing", () => {
  it("parses embedded episode metadata without evaluating provider scripts", () => {
    const html = String.raw`items:JSON.parse('[{"slug":"1","url":"/anime/example/1","title_list":{"1":"Episode 1"},"duration":"23:45","videos_count":1}]')`;

    expect(parseAniZoneEpisodes(html)).toEqual([{
      number: 1,
      sourceNumber: 1,
      title: "Episode 1",
      duration: 1425,
      hasSub: true,
    }]);
  });
});

describe("AniKoto search result parsing", () => {
  it("handles reordered attributes and rejects foreign hosts", () => {
    const html = `
      <a href="https://anikototv.to/watch/example-show/ep-1" data-jp="Example JP" class="d-title name">Example <b>Show</b></a>
      <a class="name d-title" data-jp="Evil" href="https://anikototv.to.attacker.invalid/watch/evil">Evil</a>
      <a class="name d-title" data-jp="Bad" href="http://anikototv.to/watch/insecure">Insecure</a>
      <a class="name d-title" data-jp="Duplicate" href="https://anikototv.to/watch/example-show">Duplicate</a>
    `;
    expect(parseAniKotoSearchResults(html)).toEqual([
      { slug: "example-show", japanese: "Example JP", name: "Example Show" },
    ]);
  });
});

describe("AniKoto episode parsing", () => {
  it("parses sub and dub flags and rejects duplicate episode numbers", () => {
    const html = String.raw`<a data-id="row-1" data-ids="server-1" data-num="1" data-sub="1" data-dub="0" data-mal="123"><span class="d-title">Episode 1</span></a><a data-id="row-1b" data-ids="server-1b" data-num="1" data-sub="1" data-dub="1"><span class="d-title">Duplicate</span></a><a data-id="row-2" data-ids="server-2" data-num="2" data-sub="0" data-dub="1"><span class="d-title">Episode 2</span></a>`;
    expect(parseAniKotoEpisodes(html)).toEqual([
      { number: 1, ids: "server-1", title: "Episode 1", hasSub: true, hasDub: false, malId: 123 },
      { number: 2, ids: "server-2", title: "Episode 2", hasSub: false, hasDub: true, malId: null },
    ]);
  });
});

describe("Anivexa API", () => {
  it("keeps Anivexa disabled unless explicitly enabled", async () => {
    const response = await request(app).get("/api/v1/anivexa/providers");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("ANIVEXA_DISABLED");
  });

  it("keeps stream extraction disabled until the integration is enabled", async () => {
    const response = await request(app).get("/api/v1/anivexa/extract/21/1?audio=sub");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("ANIVEXA_DISABLED");
  });

  it("does not allow invalid provider IDs", async () => {
    const response = await request(app).get("/api/v1/anivexa/episodes/not-an-id");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("ANIVEXA_DISABLED");
  });
});
