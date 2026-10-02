'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAnime, useEpisodes, useStreamUrl } from '@samren/hooks';
import { PlayerType, VideoQuality } from '@samren/types';

const qualities: VideoQuality[] = ['1080p', '720p', '480p'];

export default function WatchPage() {
  const params = useParams<{ id: string; episode: string }>();
  const router = useRouter();
  const animeId = params.id;
  const initialEpisode = Number(params.episode) || 1;
  const [episode, setEpisode] = useState(initialEpisode);
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [player, setPlayer] = useState<PlayerType>('browser');
  const [playbackState, setPlaybackState] = useState<'loading' | 'ready' | 'error'>('loading');

  const { data: animeData, isLoading: animeLoading } = useAnime(animeId);
  const { data: episodesData, isLoading: episodesLoading } = useEpisodes(animeId);
  const { data: streamData, isLoading: streamLoading, error: streamError } = useStreamUrl(
    animeId,
    episode,
    quality,
  );

  const anime = animeData?.data;
  const episodes = episodesData?.data ?? [];
  const currentIndex = useMemo(
    () => episodes.findIndex((item) => item.number === episode),
    [episodes, episode],
  );
  const currentEpisode = episodes[currentIndex] ?? episodes.find((item) => item.number === episode);
  const streamUrl = streamData?.data?.streamUrl ?? null;
  const hasVideoStream = Boolean(streamUrl);
  const streamKind = streamUrl?.includes('.m3u8')
    ? 'HLS'
    : streamUrl?.includes('.mp4')
      ? 'MP4'
      : streamUrl
        ? 'Embedded'
        : 'Unavailable';

  useEffect(() => {
    if (episodes.length && !episodes.some((item) => item.number === episode)) {
      setEpisode(episodes[0].number);
    }
  }, [episodes, episode]);

  useEffect(() => {
    if (streamLoading) setPlaybackState('loading');
    else if (streamError || !streamUrl) setPlaybackState('error');
    else setPlaybackState('ready');
  }, [streamError, streamLoading, streamUrl]);

  const navigateEpisode = (next: number) => {
    setEpisode(next);
    router.replace('/watch/' + encodeURIComponent(animeId) + '/' + next);
  };

  const retryPlayback = () => {
    setPlaybackState('loading');
    router.refresh();
  };

  if (animeLoading) {
    return <div className="min-h-screen bg-[#080c13] p-6 text-sm text-white/60">Preparing the watch experience…</div>;
  }

  if (!anime) {
    return (
      <div className="min-h-screen bg-[#080c13] p-6 text-white">
        <Link href="/" className="text-sm text-white/60 hover:text-white">← Back home</Link>
        <p className="mt-8 text-lg font-semibold">Anime not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c13] text-white">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={'/anime/' + encodeURIComponent(animeId)}
            className="rounded-lg border border-white/10 bg-[#12121B] px-3 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            ← Back
          </Link>
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">Watch screen</p>
            <h1 className="truncate text-sm font-semibold sm:text-base">{anime.title}</h1>
          </div>
        </header>

        <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
              <div className="aspect-video w-full">
                {playbackState === 'loading' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0f17]">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[#7440ff]" />
                    <div className="text-center">
                      <p className="font-medium">Preparing the stream</p>
                      <p className="mt-1 text-xs text-white/45">Season 1 · Episode {episode}</p>
                    </div>
                  </div>
                ) : playbackState === 'error' ? (
                  <div className="flex h-full flex-col items-center justify-center bg-[#0b0f17] px-6 text-center">
                    <p className="text-lg font-semibold">Playback error</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/50">
                      This source is unavailable for the selected quality. Try again or switch quality.
                    </p>
                    <div className="mt-5 flex gap-2">
                      <button type="button" onClick={retryPlayback} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuality(quality === '1080p' ? '720p' : '1080p')}
                        className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                      >
                        Switch quality
                      </button>
                    </div>
                  </div>
                ) : streamUrl && player === 'browser' ? (
                  streamUrl.includes('.m3u8') || streamUrl.includes('.mp4') ? (
                    <video src={streamUrl} controls autoPlay playsInline className="h-full w-full bg-black" />
                  ) : (
                    <iframe src={streamUrl} title={'Episode ' + episode} allowFullScreen className="h-full w-full border-0 bg-black" />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0f17] px-6 text-center">
                    <p className="font-semibold">Browser playback is not selected</p>
                    <p className="max-w-md text-sm text-white/50">The current source can be opened with the selected external player.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-[#12121B] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/40">
                    <span>Season 1</span><span>•</span><span>Episode {episode}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                    {currentEpisode?.title || 'Episode ' + episode}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                    {currentEpisode?.description || anime.description || 'Continue watching this episode.'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={currentIndex <= 0}
                    onClick={() => navigateEpisode(episodes[currentIndex - 1].number)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex < 0 || currentIndex >= episodes.length - 1}
                    onClick={() => navigateEpisode(episodes[currentIndex + 1].number)}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Source</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{hasVideoStream ? 'Primary source' : 'No source'}</p>
                      <p className="mt-1 text-xs text-white/40">{streamKind}</p>
                    </div>
                    <span className={'rounded-full px-2.5 py-1 text-[10px] font-semibold ' + (hasVideoStream ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300')}>
                      {hasVideoStream ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Player</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['browser', 'mpv'] as PlayerType[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPlayer(value)}
                        className={
                          'rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ' +
                          (player === value
                            ? 'border-[#7440ff]/60 bg-[#7440ff]/15 text-white'
                            : 'border-white/10 text-white/45 hover:text-white')
                        }
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Stream resolution & source</p>
                    <p className="mt-1 text-xs text-white/40">Choose a supported quality for the current episode.</p>
                  </div>
                  <div className="flex gap-2">
                    {qualities.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setQuality(value)}
                        className={
                          'rounded-lg border px-3 py-2 text-xs font-semibold transition ' +
                          (quality === value
                            ? 'border-[#7440ff]/60 bg-[#7440ff]/15 text-white'
                            : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white')
                        }
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-[#12121B] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Episodes</p>
                  <h3 className="mt-1 text-base font-semibold">Episode navigation</h3>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-white/45">{episodes.length} available</span>
              </div>

              <div className="mt-4 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {episodesLoading ? (
                  <p className="py-6 text-center text-sm text-white/40">Loading episodes…</p>
                ) : episodes.length ? (
                  episodes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateEpisode(item.number)}
                      className={
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ' +
                        (item.number === episode
                          ? 'border-[#7440ff]/60 bg-[#7440ff]/12'
                          : 'border-transparent bg-black/10 hover:border-white/10 hover:bg-white/[0.03]')
                      }
                    >
                      <span
                        className={
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ' +
                          (item.number === episode ? 'bg-[#7440ff] text-white' : 'bg-white/5 text-white/45')
                        }
                      >
                        {String(item.number).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white/85">{item.title || 'Episode ' + item.number}</span>
                        <span className="mt-0.5 block text-[10px] text-white/35">{item.number === episode ? 'Now playing' : 'Episode'}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-white/40">No episodes available.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#12121B] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Playback states</p>
              <div className="mt-3 space-y-2 text-xs text-white/50">
                <div className="flex items-center justify-between rounded-lg bg-black/15 px-3 py-2">
                  <span>Stream</span>
                  <span className={playbackState === 'ready' ? 'text-emerald-300' : playbackState === 'loading' ? 'text-amber-300' : 'text-red-300'}>
                    {playbackState === 'ready' ? 'Ready' : playbackState === 'loading' ? 'Loading' : 'Error'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-black/15 px-3 py-2"><span>Quality</span><span className="text-white/70">{quality}</span></div>
                <div className="flex items-center justify-between rounded-lg bg-black/15 px-3 py-2"><span>Source type</span><span className="text-white/70">{streamKind}</span></div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#7440ff]/20 bg-[#7440ff]/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b49aff]">Watch history</p>
              <p className="mt-2 text-sm font-semibold">{anime.title}</p>
              <p className="mt-1 text-xs text-white/45">Season 1 · Episode {episode}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-0 rounded-full bg-[#7440ff]" /></div>
              <p className="mt-2 text-[10px] text-white/35">Progress will appear here as the player reports playback time.</p>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
