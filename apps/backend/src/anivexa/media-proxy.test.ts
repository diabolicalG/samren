import { describe, expect, it } from "vitest";
import { rewriteDashManifest, rewriteHlsManifest } from "./media-proxy.js";

describe("Anivexa media manifest proxy", () => {
  it("rewrites HLS variant playlists and URI attributes through the same-origin relay", () => {
    const source = [
      "#EXTM3U",
      "#EXT-X-KEY:METHOD=AES-128,URI=\"keys/key.bin\"",
      "#EXTINF:6.0,",
      "segments/0001.ts",
      "https://cdn.example.test/next/720p.m3u8",
    ].join("\n");
    const result = rewriteHlsManifest(source, "https://cdn.example.test/video/master.m3u8", "https://provider.example.test/");
    expect(result).toContain("/api/v1/anivexa/media?url=https%3A%2F%2Fcdn.example.test%2Fvideo%2Fkeys%2Fkey.bin");
    expect(result).toContain("/api/v1/anivexa/media?url=https%3A%2F%2Fcdn.example.test%2Fvideo%2Fsegments%2F0001.ts");
    expect(result).toContain("/api/v1/anivexa/media?url=https%3A%2F%2Fcdn.example.test%2Fnext%2F720p.m3u8");
    expect(result).toContain("referer=https%3A%2F%2Fprovider.example.test%2F");
  });

  it("rewrites DASH segment templates while preserving substitution tokens and valid XML", () => {
    const source = [
      '<?xml version="1.0"?>',
      '<MPD><BaseURL>https://cdn.example.test/video/</BaseURL>',
      '<Period><AdaptationSet><Representation>',
      '<SegmentTemplate initialization="init-$RepresentationID$.m4s" media="chunk-$Number%05d$.m4s" />',
      '<SegmentList><SegmentURL media="segment-1.m4s" /></SegmentList>',
      "</Representation></AdaptationSet></Period></MPD>",
    ].join("");
    const result = rewriteDashManifest(source, "https://cdn.example.test/manifest.mpd", "https://provider.example.test/");
    expect(result).not.toContain("<BaseURL>");
    expect(result).toContain("chunk-$Number%05d$.m4s");
    expect(result).toContain("init-$RepresentationID$.m4s");
    expect(result).toContain("&amp;referer=");
    expect(result).toContain("/api/v1/anivexa/media?url=https%3A%2F%2Fcdn.example.test%2Fvideo%2Fsegment-1.m4s");
  });

  it("resolves nested DASH BaseURL scopes before rewriting inherited segment templates", () => {
    const source = [
      '<MPD><BaseURL>https://cdn.example.test/root/</BaseURL>',
      '<Period><BaseURL>season-1/</BaseURL>',
      '<AdaptationSet><BaseURL>video/</BaseURL>',
      '<Representation><SegmentTemplate initialization="init-$RepresentationID$.m4s" media="chunk-$Number%05d$.m4s" />',
      '</Representation></AdaptationSet></Period></MPD>',
    ].join("");
    const result = rewriteDashManifest(source, "https://cdn.example.test/manifest.mpd");
    expect(result).toContain("url=https%3A%2F%2Fcdn.example.test%2Froot%2Fseason-1%2Fvideo%2Finit-$RepresentationID$.m4s");
    expect(result).toContain("url=https%3A%2F%2Fcdn.example.test%2Froot%2Fseason-1%2Fvideo%2Fchunk-$Number%05d$.m4s");
    expect(result).not.toContain("<BaseURL>");
  });

  it("decodes XML entities in BaseURL values and preserves query strings", () => {
    const source = '<MPD><BaseURL>https://cdn.example.test/video/</BaseURL><SegmentURL media="seg.m4s?token=a&amp;part=1" /></MPD>';
    const result = rewriteDashManifest(source, "https://cdn.example.test/manifest.mpd");
    expect(result).toContain("token%3Da%26part%3D1");
    expect(result).toContain("seg.m4s");
    expect(result).toContain("url=https%3A%2F%2Fcdn.example.test%2Fvideo%2Fseg.m4s%3Ftoken%3Da%26part%3D1");
  });

  it("rewrites DASH Location and XML namespace URL attributes", () => {
    const source = '<MPD><Location>next.mpd</Location><SegmentURL xlink:href="segment.m4s" /></MPD>';
    const result = rewriteDashManifest(source, "https://cdn.example.test/path/manifest.mpd");
    expect(result).toContain("<Location>/api/v1/anivexa/media?url=https%3A%2F%2Fcdn.example.test%2Fpath%2Fnext.mpd</Location>");
    expect(result).toContain("xlink:href=\"/api/v1/anivexa/media?url=https%3A%2F%2Fcdn.example.test%2Fpath%2Fsegment.m4s\"");
  });

  it("leaves data and blob resources untouched", () => {
    const source = "#EXTM3U\ndata:application/octet-stream;base64,AAAA\nblob:https://app.example.test/id";
    const result = rewriteHlsManifest(source, "https://cdn.example.test/master.m3u8");
    expect(result).toBe(source);
  });
});
