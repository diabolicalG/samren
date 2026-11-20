import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindProviderSession, clearPlaybackResourceRegistryForTests, createPlaybackResourceHandle,
  isProviderSessionBound, resolvePlaybackResourceHandle, revokePlaybackResourcesForProviderSession,
} from "./resource-registry.js";

vi.mock("./http.js", () => ({
  anivexaAllowedHosts: () => new Set(["provider.test"]),
  anivexaStreamAllowedHosts: () => new Set(["media.test"]),
}));
vi.mock("./core/safe-fetch.js", () => ({
  isAnivexaUrlAllowed: (value: string, allowed: Set<string>) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && allowed.has(url.hostname);
    } catch { return false; }
  },
}));

const sessionToken = "a".repeat(43);
const providerSessionId = "8f11a28a-3c6d-4b3b-b1fd-3d5e8b1f3f7a";

afterEach(() => clearPlaybackResourceRegistryForTests());

describe("opaque provider media resources", () => {
  it("issues an opaque handle bound to a signed playback session and provider session", () => {
    const handle = createPlaybackResourceHandle({
      url: "https://media.test/master.m3u8",
      referer: "https://provider.test/watch/1",
      sessionToken,
      providerSessionId,
      kind: "hls",
    });
    expect(handle).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(handle).not.toContain("media.test");
    expect(resolvePlaybackResourceHandle(handle, sessionToken)).toMatchObject({
      url: "https://media.test/master.m3u8",
      referer: "https://provider.test/watch/1",
      providerSessionId,
      kind: "hls",
    });
    expect(resolvePlaybackResourceHandle(handle, "b".repeat(43))).toBeNull();
    expect(isProviderSessionBound(providerSessionId, sessionToken)).toBe(true);
    expect(isProviderSessionBound(providerSessionId, "b".repeat(43))).toBe(false);
  });

  it("rejects non-allowlisted upstream and referer URLs", () => {
    expect(() => createPlaybackResourceHandle({
      url: "https://evil.test/master.m3u8", sessionToken, providerSessionId,
    })).toThrow("not allowlisted");
    expect(() => createPlaybackResourceHandle({
      url: "https://media.test/master.m3u8", referer: "https://evil.test/",
      sessionToken, providerSessionId,
    })).toThrow("referer is not allowlisted");
  });

  it("revokes all handles and the session binding when a provider session closes", () => {
    const handle = createPlaybackResourceHandle({
      url: "https://media.test/video.mp4", sessionToken, providerSessionId, kind: "mp4",
    });
    revokePlaybackResourcesForProviderSession(providerSessionId);
    expect(resolvePlaybackResourceHandle(handle, sessionToken)).toBeNull();
    expect(isProviderSessionBound(providerSessionId, sessionToken)).toBe(false);
  });

  it("does not allow a provider session to be rebound to a different playback cookie", () => {
    bindProviderSession(providerSessionId, sessionToken);
    expect(() => bindProviderSession(providerSessionId, "b".repeat(43))).toThrow("already bound");
  });
});
