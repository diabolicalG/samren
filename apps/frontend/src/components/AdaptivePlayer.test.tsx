import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdaptivePlayer } from "./AdaptivePlayer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdaptivePlayer", () => {
  it("attaches HLS.js and recovers one fatal media error before reporting failure", () => {
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
    expect(hlsInstance.attachMedia).toHaveBeenCalledWith(video);
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

  it("initializes dash.js and forwards fatal engine errors", () => {
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
    expect(dashPlayer.initialize).toHaveBeenCalledWith(container.querySelector("video"), "/api/v1/anivexa/media?url=x&kind=dash", false);
    const callback = dashPlayer.on.mock.calls[0]?.[1] as (event: unknown) => void;
    callback({ error: { code: 27 } });
    expect(onError).toHaveBeenCalledTimes(1);
    unmount();
    expect(dashPlayer.reset).toHaveBeenCalledTimes(1);
  });

  it("restores the saved position after metadata becomes available", () => {
    const { container } = render(<AdaptivePlayer src="/media/video.mp4" type="mp4" resumeAt={45} onError={vi.fn()} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(45);
  });
});
