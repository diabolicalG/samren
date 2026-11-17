import { describe, expect, it } from "vitest";
import { convertSrtToWebVtt } from "./subtitles.js";

describe("SubRip to WebVTT conversion", () => {
  it("removes cue indexes and converts comma timestamps", () => {
    const input = "\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\nHello, world!\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nSecond cue";
    expect(convertSrtToWebVtt(input)).toBe("WEBVTT\n\n00:00:01.250 --> 00:00:03.500\nHello, world!\n\n00:00:04.000 --> 00:00:05.000\nSecond cue\n");
  });

  it("preserves cue settings and rejects malformed files", () => {
    const input = "1\n00:00:01,000 --> 00:00:02,000 position:10%\nText";
    expect(convertSrtToWebVtt(input)).toContain("00:00:01.000 --> 00:00:02.000 position:10%");
    expect(() => convertSrtToWebVtt("not a subtitle")).toThrow(/valid SubRip cues/);
  });
});
