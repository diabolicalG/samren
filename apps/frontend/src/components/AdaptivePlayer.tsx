import { useEffect, useRef, useState } from "react";

type StreamType = "hls" | "mp4" | "dash";
type HlsErrorData = { fatal?: boolean; type?: string };

interface HlsInstance {
  loadSource(url: string): void;
  attachMedia(video: HTMLVideoElement): void;
  on(event: string, callback: (_event: string, data: HlsErrorData) => void): void;
  startLoad(): void;
  recoverMediaError(): void;
  destroy(): void;
}
interface HlsConstructor {
  new (options?: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: { ERROR: string };
  ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string };
}
interface DashPlayer {
  initialize(video: HTMLVideoElement, url: string, autoplay: boolean): void;
  on(event: string, callback: (event: unknown) => void): void;
  off(event: string, callback?: (event: unknown) => void): void;
  updateSettings(settings: Record<string, unknown>): void;
  reset(): void;
}
interface DashRuntime {
  MediaPlayer(): { create(): DashPlayer };
}

declare global {
  interface Window {
    Hls?: HlsConstructor;
    dashjs?: DashRuntime;
  }
}

type AdaptivePlayerProps = {
  src: string;
  type: StreamType;
  resumeAt?: number;
  autoPlay?: boolean;
  onTimeUpdate?: (seconds: number) => void;
  onEnded?: () => void;
  onError: () => void;
  onReady?: () => void;
};

export function AdaptivePlayer({
  src,
  type,
  resumeAt = 0,
  autoPlay = false,
  onTimeUpdate,
  onEnded,
  onError,
  onReady,
}: AdaptivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onError, onReady });
  callbacks.current = { onError, onReady };
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let fatalReported = false;
    let networkRecoveryUsed = false;
    let mediaRecoveryUsed = false;
    let hls: HlsInstance | null = null;
    let dash: DashPlayer | null = null;

    const reportFatal = () => {
      if (disposed || fatalReported) return;
      fatalReported = true;
      callbacks.current.onError();
    };

    const restorePosition = () => {
      if (resumeAt > 0 && Number.isFinite(video.duration) && resumeAt < video.duration) {
        try { video.currentTime = resumeAt; } catch { /* metadata may not be seekable yet */ }
      }
      if (autoPlay) void video.play().catch(() => undefined);
      callbacks.current.onReady?.();
    };

    video.addEventListener("loadedmetadata", restorePosition);
    video.addEventListener("error", reportFatal);

    if (type === "hls") {
      if (window.Hls?.isSupported()) {
        hls = new window.Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 60 });
        hls.on(window.Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return;
          if (data.type === window.Hls?.ErrorTypes.NETWORK_ERROR && !networkRecoveryUsed) {
            networkRecoveryUsed = true;
            hls?.startLoad();
            return;
          }
          if (data.type === window.Hls?.ErrorTypes.MEDIA_ERROR && !mediaRecoveryUsed) {
            mediaRecoveryUsed = true;
            hls?.recoverMediaError();
            return;
          }
          reportFatal();
        });
        hls.attachMedia(video);
        hls.loadSource(src);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.load();
      } else {
        setRuntimeError("HLS playback is not supported by this browser. Update the browser or use a supported device.");
        reportFatal();
      }
    } else if (type === "dash") {
      if (window.dashjs) {
        dash = window.dashjs.MediaPlayer().create();
        dash.updateSettings({
          streaming: {
            lowLatencyEnabled: false,
            buffer: { fastSwitchEnabled: true, stableBufferTime: 12, bufferTimeAtTopQuality: 24 },
          },
        });
        dash.on("error", reportFatal);
        dash.initialize(video, src, autoPlay);
      } else {
        setRuntimeError("The DASH playback engine could not be loaded. Check the connection and refresh.");
        reportFatal();
      }
    } else {
      video.src = src;
      video.load();
    }

    return () => {
      disposed = true;
      video.removeEventListener("loadedmetadata", restorePosition);
      video.removeEventListener("error", reportFatal);
      hls?.destroy();
      dash?.reset();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, type, resumeAt, autoPlay]);

  return (
    <div className="adaptive-player">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        onTimeUpdate={(event) => onTimeUpdate?.(Math.floor(event.currentTarget.currentTime))}
        onEnded={onEnded}
        aria-label="Anime episode video player"
      >
        Your browser does not support video playback.
      </video>
      {runtimeError ? <p className="player-runtime-error" role="alert">{runtimeError}</p> : null}
    </div>
  );
}
