import { useCallback, useState } from "react";
import { apiClient } from "@samren/api-client";

type PlaybackSession = Awaited<ReturnType<typeof apiClient.aggregatePlayback>>;
type PlaybackStream = PlaybackSession["stream"];

export function useProviderPlayback() {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (anilistId: number, episode: number, audio: "sub" | "dub" = "sub") => {
    setIsStarting(true);
    setError(null);
    setSession(null);
    try {
      const result = await apiClient.aggregatePlayback(anilistId, episode, audio);
      setSession(result);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No provider could start playback");
      throw cause;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const reportPlaybackError = useCallback(async (): Promise<PlaybackStream | null> => {
    if (!session || isSwitching) return null;
    setIsSwitching(true);
    setError(null);
    try {
      const result = await apiClient.fallbackPlayback(session.sessionId, session.stream.provider);
      setSession((current) => current?.sessionId === session.sessionId
        ? { ...current, stream: result.stream }
        : current);
      return result.stream;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No alternate provider is available");
      return null;
    } finally {
      setIsSwitching(false);
    }
  }, [isSwitching, session]);

  const close = useCallback(async () => {
    const current = session;
    setSession(null);
    setError(null);
    if (current) await apiClient.closePlaybackSession(current.sessionId).catch(() => undefined);
  }, [session]);

  return {
    session,
    stream: session?.stream ?? null,
    isStarting,
    isSwitching,
    error,
    start,
    reportPlaybackError,
    close,
  };
}
