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

const runtimeLoads = new Map<string, Promise<void>>();
const runtimeSources = {
  hls: "https://cdn.jsdelivr.net/npm/hls.js@1.7.4/dist/hls.min.js",
  dash: "https://cdn.dashjs.org/v5.3.0/modern/umd/dash.all.min.js",
};

function ensureRuntime(name: "hls" | "dash"): Promise<void> {
  if (name === "hls" && window.Hls) return Promise.resolve();
  if (name === "dash" && window.dashjs) return Promise.resolve();
  const existing = runtimeLoads.get(name);
  if (existing) return existing;
  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = runtimeSources[name];
    script.async = true;
    script.crossOrigin = "anonymous";
    script.referrerPolicy = "no-referrer";
    script.onload = () => {
      if ((name === "hls" && window.Hls) || (name === "dash" && window.dashjs)) resolve();
      else reject(new Error("Adaptive player runtime did not expose its browser API"));
    };
    script.onerror = () => reject(new Error("Adaptive player runtime could not be downloaded"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    runtimeLoads.delete(name);
    throw error;
  });
  runtimeLoads.set(name, loading);
  return loading;
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
  subtitles?: Array<{ src: string; label: string; srclang: string; default?: boolean }>;
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
  subtitles = [],
}: AdaptivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onError, onReady });
  const autoPlayRef = useRef(autoPlay);
  callbacks.current = { onError, onReady };
  autoPlayRef.current = autoPlay;
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
      if (autoPlayRef.current) void video.play().catch(() => undefined);
      callbacks.current.onReady?.();
    };

    video.addEventListener("loadedmetadata", restorePosition);
    video.addEventListener("error", reportFatal);

    if (type === "hls") {
      if (video.canPlayType("application/vnd.apple.mpegurl") && "ManagedMediaSource" in window) {
        video.src = src;
      } else {
        void ensureRuntime("hls").then(() => {
          if (disposed) return;
          if (!window.Hls?.isSupported()) {
            if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = src;
            else {
              setRuntimeError("HLS playback is not supported by this browser or device.");
              reportFatal();
            }
            return;
          }
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
        }).catch(() => {
          if (disposed) return;
          if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = src;
          else {
            setRuntimeError("The HLS playback engine could not be loaded. Check the connection and refresh.");
            reportFatal();
          }
        });
      }
    } else if (type === "dash") {
      void ensureRuntime("dash").then(() => {
        if (disposed || !window.dashjs) return;
        dash = window.dashjs.MediaPlayer().create();
        dash.updateSettings({
          streaming: {
            lowLatencyEnabled: false,
            buffer: { fastSwitchEnabled: true, stableBufferTime: 12, bufferTimeAtTopQuality: 24 },
          },
        });
        dash.on("error", reportFatal);
        dash.initialize(video, src, autoPlayRef.current);
      }).catch(() => {
        if (disposed) return;
        setRuntimeError("The DASH playback engine could not be loaded. Check the connection and refresh.");
        reportFatal();
      });
    } else {
      video.src = src;
    }

    return () => {
      disposed = true;
      video.removeEventListener("loadedmetadata", restorePosition);
      video.removeEventListener("error", reportFatal);
      hls?.destroy();
      dash?.reset();
      video.removeAttribute("src");
    };
  }, [src, type, resumeAt]);

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
        {subtitles.map((track, index) => (
          <track
            key={`${track.srclang}-${track.label}-${index}`}
            kind="subtitles"
            src={track.src}
            srcLang={track.srclang}
            label={track.label}
            default={track.default === true}
          />
        ))}
        Your browser does not support video playback.
      </video>
      {runtimeError ? <p className="player-runtime-error" role="alert">{runtimeError}</p> : null}
    </div>
  );
}
