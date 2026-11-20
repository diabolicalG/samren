import { describe, expect, it } from "vitest";
import { detectMediaSignature } from "./signature.js";

describe("media signature detection", () => {
  it("recognizes supported image signatures", () => {
    expect(detectMediaSignature("POSTER", Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.mimeType).toBe("image/jpeg");
    expect(detectMediaSignature("BANNER", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mimeType).toBe("image/png");
    expect(detectMediaSignature("POSTER", Buffer.from("RIFF0000WEBP"))?.mimeType).toBe("image/webp");
  });

  it("recognizes supported video signatures", () => {
    expect(detectMediaSignature("VIDEO", Buffer.from("0000ftypisom"))?.mimeType).toBe("video/mp4");
    expect(detectMediaSignature("VIDEO", Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))?.mimeType).toBe("video/webm");
  });

  it("recognizes subtitle formats and rejects mismatched content", () => {
    expect(detectMediaSignature("SUBTITLE", Buffer.from("WEBVTT\n\n00:00:01.000 --> 00:00:02.000"))?.mimeType).toBe("text/vtt");
    expect(detectMediaSignature("SUBTITLE", Buffer.from("1\n00:00:01,000 --> 00:00:02,000"))?.mimeType).toBe("application/x-subrip");
    expect(detectMediaSignature("SUBTITLE", Buffer.from("[Script Info]\n"))?.mimeType).toBe("application/x-ass");
    expect(detectMediaSignature("VIDEO", Buffer.from("not a video"))).toBeNull();
    expect(detectMediaSignature("SUBTITLE", Buffer.from([0xff, 0xfe, 0xff]))).toBeNull();
  });
});
