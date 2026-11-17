import { useCallback, useRef, useState } from "react";
import { apiClient } from "@samren/api-client";

type PlaybackSession = Awaited<ReturnType<typeof apiClient.aggregatePlayback>>;
type PlaybackStream = PlaybackSession["stream"];

export function useProviderPlayback() {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const sessionRef = useRef<PlaybackSession | null>(null);
  const operationRef = useRef(0);
  const switchingRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (anilistId: number, episode: number, audio: "sub" | "dub" = "sub") => {
    const operation = ++operationRef.current;
    const previous = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    setIsStarting(true);
    setIsSwitching(false);
    switchingRef.current = false;
    setError(null);
    if (previous) await apiClient.closePlaybackSession(previous.sessionId).catch(() => undefined);
    try {
      const result = await apiClient.aggregatePlayback(anilistId, episode, audio);
      if (operation !== operationRef.current) {
        await apiClient.closePlaybackSession(result.sessionId).catch(() => undefined);
        throw new Error("Playback request was superseded by a newer episode.");
      }
      sessionRef.current = result;
      setSession(result);
      return result;
    } catch (cause) {
      if (operation === operationRef.current) {
        setError(cause instanceof Error ? cause.message : "No provider could start playback");
      }
      throw cause;
    } finally {
      if (operation === operationRef.current) setIsStarting(false);
    }
  }, []);

  const reportPlaybackError = useCallback(async (): Promise<PlaybackStream | null> => {
    const current = sessionRef.current;
    if (!current || switchingRef.current) return null;
    const operation = operationRef.current;
    switchingRef.current = true;
    setIsSwitching(true);
    setError(null);
    try {
      const result = await apiClient.fallbackPlayback(current.sessionId, current.stream.provider);
      if (operation !== operationRef.current || sessionRef.current?.sessionId !== current.sessionId) return null;
      const updated = { ...current, stream: result.stream };
      sessionRef.current = updated;
      setSession(updated);
      return result.stream;
    } catch (cause) {
      if (operation === operationRef.current && sessionRef.current?.sessionId === current.sessionId) {
        setError(cause instanceof Error ? cause.message : "No alternate provider is available");
      }
      return null;
    } finally {
      if (operation === operationRef.current) {
        switchingRef.current = false;
        setIsSwitching(false);
      }
    }
  }, []);

  const close = useCallback(async () => {
    operationRef.current += 1;
    switchingRef.current = false;
    const current = sessionRef.current;
    sessionRef.current = null;
    setSession(null);
    setIsStarting(false);
    setIsSwitching(false);
    setError(null);
    if (current) await apiClient.closePlaybackSession(current.sessionId).catch(() => undefined);
  }, []);

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
