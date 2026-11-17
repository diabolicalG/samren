import { afterEach, describe, expect, it } from "vitest";
import { ProviderAggregator, type ProviderAdapter } from "./aggregator.js";

const previousHosts = process.env.ANIVEXA_STREAM_ALLOWED_HOSTS;

afterEach(() => {
  if (previousHosts === undefined) delete process.env.ANIVEXA_STREAM_ALLOWED_HOSTS;
  else process.env.ANIVEXA_STREAM_ALLOWED_HOSTS = previousHosts;
});

function stream(url = "https://cdn.example-stream.net/episode.m3u8") {
  return { streams: [{ url, type: "hls", provider: "test", server: "primary", quality: "1080p" }] };
}

describe("Anivexa provider aggregator", () => {
  it("selects the first provider that returns a valid allowlisted stream and falls back to another worker", async () => {
    const providers: ProviderAdapter[] = [
      { id: "animegg", label: "AnimeGG", extract: async () => { throw new Error("offline"); } },
      { id: "anizone", label: "AniZone", extract: async () => stream() },
      { id: "anikoto", label: "AniKoto", extract: async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return stream("https://cdn.example-stream.net/backup.m3u8");
      } },
    ];
    const aggregator = new ProviderAggregator({ concurrency: 3, streamAllowedHosts: new Set(["example-stream.net"]) }, providers);
    const selected = await aggregator.start(21, 4, "sub");
    expect(selected.stream.provider).toBe("anizone");
    expect(selected.providers).toBe(3);
    expect(Date.parse(selected.expiresAt) - Date.now()).toBeGreaterThan(55 * 60 * 1000);

    const fallback = await aggregator.fallback(selected.sessionId, "anizone");
    expect(fallback.stream.provider).toBe("anikoto");
    expect(fallback.tried).toEqual(["anizone", "anikoto"]);
    expect(fallback.remaining).toBe(1);
  });

  it("rejects a provider response that is not on the configured stream allowlist", async () => {
    const providers: ProviderAdapter[] = [
      { id: "animegg", label: "AnimeGG", extract: async () => stream("https://attacker.invalid/steal.m3u8") },
    ];
    const aggregator = new ProviderAggregator({ streamAllowedHosts: new Set(["example-stream.net"]) }, providers);
    await expect(aggregator.start(21, 1, "sub")).rejects.toThrow(/All configured providers failed/);
  });

  it("does not allow a client to report a different provider as failed", async () => {
    const providers: ProviderAdapter[] = [
      { id: "animegg", label: "AnimeGG", extract: async () => stream() },
      { id: "anizone", label: "AniZone", extract: async () => stream() },
    ];
    const aggregator = new ProviderAggregator({ streamAllowedHosts: new Set(["example-stream.net"]) }, providers);
    const selected = await aggregator.start(21, 2, "dub");
    await expect(aggregator.fallback(selected.sessionId, selected.stream.provider === "animegg" ? "anizone" : "animegg"))
      .rejects.toThrow(/does not match the active provider/);
  });
});
