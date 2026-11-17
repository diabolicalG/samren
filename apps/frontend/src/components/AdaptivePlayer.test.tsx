import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptivePlayer } from "./AdaptivePlayer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdaptivePlayer", () => {
  it("attaches HLS.js and recovers one fatal media error before reporting failure", async () => {
    const hlsInstance = {
      attachMedia: vi.fn(),
      loadSource: vi.fn(),
      on: vi.fn(),
      startLoad: vi.fn(),
      recoverMediaError: vi.fn(),
      destroy: vi.fn(),
    };
    const FakeHls = vi.fn().mockImplementation(() => hlsInstance);
    Object.assign(FakeHls, {
      isSupported: () => true,
      Events: { ERROR: "hlsError" },
      ErrorTypes: { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" },
    });
    vi.stubGlobal("Hls", FakeHls);
    const onError = vi.fn();
    const { container, unmount } = render(<AdaptivePlayer src="/api/v1/anivexa/media?url=x&kind=hls" type="hls" onError={onError} />);
    const video = container.querySelector("video")!;
    await waitFor(() => expect(hlsInstance.attachMedia).toHaveBeenCalledWith(video));
    expect(hlsInstance.loadSource).toHaveBeenCalledWith("/api/v1/anivexa/media?url=x&kind=hls");
    const callback = hlsInstance.on.mock.calls[0]?.[1] as (_event: string, data: { fatal?: boolean; type?: string }) => void;
    callback("hlsError", { fatal: true, type: "mediaError" });
    expect(hlsInstance.recoverMediaError).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    callback("hlsError", { fatal: true, type: "mediaError" });
    expect(onError).toHaveBeenCalledTimes(1);
    unmount();
    expect(hlsInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("initializes dash.js and forwards fatal engine errors", async () => {
    const dashPlayer = {
      initialize: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      updateSettings: vi.fn(),
      reset: vi.fn(),
    };
    vi.stubGlobal("dashjs", { MediaPlayer: () => ({ create: () => dashPlayer }) });
    const onError = vi.fn();
    const { container, unmount } = render(<AdaptivePlayer src="/api/v1/anivexa/media?url=x&kind=dash" type="dash" onError={onError} />);
    await waitFor(() => expect(dashPlayer.initialize).toHaveBeenCalledWith(container.querySelector("video"), "/api/v1/anivexa/media?url=x&kind=dash", false));
    const callback = dashPlayer.on.mock.calls[0]?.[1] as (event: unknown) => void;
    callback({ error: { code: 27 } });
    expect(onError).toHaveBeenCalledTimes(1);
    unmount();
    expect(dashPlayer.reset).toHaveBeenCalledTimes(1);
  });

  it("renders available subtitle tracks as native video tracks", () => {
    const subtitles = [
      { src: "/media/subtitles/en.vtt", label: "English", srclang: "en", default: true },
      { src: "/media/subtitles/ja.vtt", label: "Japanese", srclang: "ja", default: false },
    ];
    const { container } = render(
      <AdaptivePlayer src="/media/video.mp4" type="mp4" subtitles={subtitles} onError={vi.fn()} />,
    );
    const tracks = Array.from(container.querySelectorAll("video track"));
    expect(tracks).toHaveLength(2);
    expect(tracks[0]?.getAttribute("src")).toBe("/media/subtitles/en.vtt");
    expect(tracks[0]?.getAttribute("srclang")).toBe("en");
    expect(tracks[0]?.getAttribute("label")).toBe("English");
    expect(tracks[0]?.hasAttribute("default")).toBe(true);
    expect(tracks[1]?.hasAttribute("default")).toBe(false);
  });

  it("restores the saved position after metadata becomes available", () => {
    const { container } = render(<AdaptivePlayer src="/media/video.mp4" type="mp4" resumeAt={45} onError={vi.fn()} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(45);
  });
});
