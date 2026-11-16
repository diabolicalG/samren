import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { isAnivexaUrlAllowed } from "./http.js";
import { aniZoneStreamType, parseAniZoneEpisodes, parseAniZonePlayerData } from "./anizone.js";
import { parseAniKotoEpisodes, parseAniKotoSearchResults, parseAniKotoServerItems } from "./anikoto.js";
import { parseAniKotoDirectSource, extractAniKotoEmbed, parseMegaPlayRoutes, decryptStaticMegaPlay } from "./anikoto-embed.js";
import { validateAnimeOnsenOrigin, isAnimeOnsenMediaUrlAllowed, videoSubtitles } from "./providers/animeonsen.js";
import { createCipheriv } from "node:crypto";


describe("AnimeOnsen dynamic-origin and media URL policy", () => {
  it("accepts only explicitly configured HTTPS API and search origins", () => {
    const allowed = new Set(["api.animeonsen.example"]);
    expect(validateAnimeOnsenOrigin("https://api.animeonsen.example/", allowed)).toBe("https://api.animeonsen.example");
    expect(() => validateAnimeOnsenOrigin("https://api.animeonsen.example.attacker.invalid/", allowed)).toThrow();
    expect(() => validateAnimeOnsenOrigin("http://api.animeonsen.example/", allowed)).toThrow();
    expect(() => validateAnimeOnsenOrigin("https://user:secret@api.animeonsen.example/", allowed)).toThrow();
    expect(() => validateAnimeOnsenOrigin("https://api.animeonsen.example/redirect", allowed)).toThrow();
    expect(() => validateAnimeOnsenOrigin("https://api.animeonsen.example:8443/", allowed)).toThrow();
  });

  it("allows only HTTPS stream/subtitle hosts from the separate media allowlist", () => {
    const allowed = new Set(["animeonsen-cdn.example"]);
    expect(isAnimeOnsenMediaUrlAllowed("https://media.animeonsen-cdn.example/episode.mpd", allowed)).toBe(true);
    expect(isAnimeOnsenMediaUrlAllowed("http://media.animeonsen-cdn.example/episode.mpd", allowed)).toBe(false);
    expect(isAnimeOnsenMediaUrlAllowed("https://animeonsen-cdn.example.attacker.invalid/episode.mpd", allowed)).toBe(false);
    expect(isAnimeOnsenMediaUrlAllowed("https://user:secret@animeonsen-cdn.example/episode.mpd", allowed)).toBe(false);
    expect(isAnimeOnsenMediaUrlAllowed("https://animeonsen-cdn.example:8443/episode.mpd", allowed)).toBe(false);
  });
});

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

describe("AnimeOnsen subtitle metadata", () => {
  it("filters untrusted subtitle hosts and never forwards bearer headers", () => {
    const previous = process.env.ANIVEXA_STREAM_ALLOWED_HOSTS;
    process.env.ANIVEXA_STREAM_ALLOWED_HOSTS = "animeonsen-cdn.example";
    try {
      expect(videoSubtitles({
        metadata: { subtitles: { en: "English", xx: "Unknown" } },
        uri: { subtitles: {
          en: "https://animeonsen-cdn.example/en.vtt",
          xx: "https://attacker.invalid/xx.vtt",
        } },
      })).toEqual([{
        url: "https://animeonsen-cdn.example/en.vtt",
        label: "English",
        srclang: "en",
        default: false,
      }]);
    } finally {
      if (previous === undefined) delete process.env.ANIVEXA_STREAM_ALLOWED_HOSTS;
      else process.env.ANIVEXA_STREAM_ALLOWED_HOSTS = previous;
    }
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



describe("AniZone media format detection", () => {
  it("recognizes HLS and MP4 paths, including query strings and uppercase extensions", () => {
    expect(aniZoneStreamType("https://cdn.example-stream.net/episode.m3u8?token=abc")).toBe("hls");
    expect(aniZoneStreamType("https://cdn.example-stream.net/episode.MP4")).toBe("mp4");
    expect(aniZoneStreamType("https://cdn.example-stream.net/episode.m4v")).toBe("mp4");
  });

  it("rejects unsupported and invalid media URLs", () => {
    expect(aniZoneStreamType("https://cdn.example-stream.net/watch/123")).toBeNull();
    expect(aniZoneStreamType("not a URL")).toBeNull();
  });
});

describe("AniZone player payload parsing", () => {
  it("extracts the static Vidstack HLS source and subtitle metadata", () => {
    const payload = { src: "https://cdn.example-stream.net/episode.m3u8", subtitles: [{ file: "https://cdn.example-stream.net/en.vtt", title: "English", language: "en", format: "vtt", default: true }] };
    const html = "<script>vidstackPlayer(JSON.parse('" + JSON.stringify(payload) + "'));</script>";
    expect(parseAniZonePlayerData(html)).toEqual({
      src: "https://cdn.example-stream.net/episode.m3u8",
      subtitles: [{
        file: "https://cdn.example-stream.net/en.vtt",
        title: "English",
        language: "en",
        format: "vtt",
        default: true,
      }],
    });
  });

  it("rejects missing, malformed and non-string player sources", () => {
    expect(parseAniZonePlayerData("<html>no player</html>")).toBeNull();
    expect(parseAniZonePlayerData("vidstackPlayer(JSON.parse('not-json'))")).toBeNull();
    expect(parseAniZonePlayerData(String.raw`vidstackPlayer(JSON.parse('{"src":42}'))`)).toBeNull();
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



describe("AniKoto server-list parsing", () => {
  const html = String.raw`<div class="type" data-type="sub"><ul><li data-link-id="sub-1"><a>Sub Server</a></li><li data-link-id="sub-2">Backup</li></ul></div><div class="type" data-type="dub"><ul><li data-link-id="dub-1">Dub Server</li></ul></div><div class="type" data-type="dl"><ul><li data-link-id="download-1">Download</li></ul></div>`;

  it("selects only the requested audio servers and supports hardsub for sub", () => {
    expect(parseAniKotoServerItems(html, "sub")).toEqual([
      { linkId: "sub-1", name: "Sub Server", serverType: "sub" },
      { linkId: "sub-2", name: "Backup", serverType: "sub" },
    ]);
    expect(parseAniKotoServerItems(html.replace('data-type="sub"', 'data-type="hsub"'), "sub")[0].serverType).toBe("hsub");
    expect(parseAniKotoServerItems(html, "dub")).toEqual([
      { linkId: "dub-1", name: "Dub Server", serverType: "dub" },
    ]);
  });
});



describe("AniKoto direct and embed source policy", () => {
  it("accepts HTTPS direct media and safely decodes base64 URL fragments", () => {
    const direct = "https://cdn.example-stream.net/video.m3u8";
    expect(parseAniKotoDirectSource(direct)).toEqual({ url: direct, type: "hls" });
    const encoded = Buffer.from(direct).toString("base64url");
    expect(parseAniKotoDirectSource("https://player.invalid/embed#"+encoded)).toEqual({ url: direct, type: "hls" });
  });

  it("rejects insecure, unsupported and non-media direct sources", () => {
    expect(parseAniKotoDirectSource("http://cdn.example-stream.net/video.m3u8")).toBeNull();
    expect(parseAniKotoDirectSource("https://cdn.example-stream.net/watch/123")).toBeNull();
    expect(parseAniKotoDirectSource("https://user:pass@cdn.example-stream.net/video.mp4")).toBeNull();
  });

  it("does not fetch embed pages outside the upstream host allowlist", async () => {
    await expect(extractAniKotoEmbed("https://player.attacker.invalid/embed-1/abc", new Set(["example-stream.net"]))).resolves.toEqual([]);
  });
});



describe("AniKoto safe embed extraction primitives", () => {
  it("identifies legacy and modern MegaPlay source routes without evaluating JavaScript", () => {
    expect(parseMegaPlayRoutes(String.raw`const a = "stream/getSources"; const b = "stream/getSources2";`)).toEqual({
      legacy: "stream/getSources",
      modern: "stream/getSources2",
    });
  });

  it("ignores route-like text inside comments and regular expressions while decoding escaped literals", () => {
    const script = String.raw`// "stream/getSources-fake"
const pattern = /stream\/getSources-regex/;
const route = "stream\x2fgetSources";
const modern = "stream/getSources2";`;
    expect(parseMegaPlayRoutes(script)).toEqual({ legacy: "stream/getSources", modern: "stream/getSources2" });
  });
  it("decrypts a static AES-CBC source payload from literal key and IV values", () => {
    const keyText = "0123456789abcdef";
    const ivText = "abcdef0123456789";
    const key = Buffer.alloc(32);
    Buffer.from(keyText).copy(key);
    const cipher = createCipheriv("aes-256-cbc", key, Buffer.from(ivText));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ file: "https://cdn.example-stream.net/video.m3u8" })), cipher.final()]).toString("base64url");
    const script = 'const key = "' + keyText + '"; const iv = "' + ivText + '";';
    expect(decryptStaticMegaPlay(encrypted, script)).toBe("https://cdn.example-stream.net/video.m3u8");
  });

  it("fails closed when an encrypted payload cannot be decoded", () => {
    expect(decryptStaticMegaPlay("not-valid-encrypted-data", 'const x = "literal";')).toBeNull();
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
