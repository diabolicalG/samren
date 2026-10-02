'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAnime, useEpisodes, useStreamUrl } from '@samren/hooks';
import { PlayerType, VideoQuality } from '@samren/types';

export default function WatchPage() {
  const params = useParams<{ id: string; episode: string }>();
  const router = useRouter();
  const animeId = params.id;
  const initialEpisode = Number(params.episode) || 1;
  const [episode, setEpisode] = useState(initialEpisode);
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [player, setPlayer] = useState<PlayerType>('browser');

  const { data: animeData, isLoading: animeLoading } = useAnime(animeId);
  const { data: episodesData, isLoading: episodesLoading } = useEpisodes(animeId);
  const { data: streamData, isLoading: streamLoading, error: streamError } = useStreamUrl(
    animeId,
    episode,
    quality,
  );

  const anime = animeData?.data;
  const episodes = episodesData?.data ?? [];
  const currentIndex = useMemo(() => episodes.findIndex((item) => item.number === episode), [episodes, episode]);
  const currentEpisode = episodes[currentIndex] ?? episodes.find((item) => item.number === episode);

  useEffect(() => {
    if (episodes.length && !episodes.some((item) => item.number === episode)) {
      setEpisode(episodes[0].number);
    }
  }, [episodes, episode]);

  const navigateEpisode = (next: number) => {
    setEpisode(next);
    router.replace(`/watch/${encodeURIComponent(animeId)}/${next}`);
  };

  if (animeLoading) return <div className="min-h-screen bg-background p-6 text-subtle">Loading watch experience…</div>;
  if (!anime) return <div className="min-h-screen bg-background p-6 text-red-400">Anime not found.</div>;

  const streamUrl = streamData?.data?.streamUrl ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`/anime/${encodeURIComponent(animeId)}`} className="text-sm text-subtle hover:text-white">← Back to anime</Link>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-subtle">Watching</p>
            <h1 className="text-lg font-semibold text-white">{anime.title}</h1>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-black shadow-panel">
          <div className="aspect-video w-full">
            {streamLoading ? (
              <div className="flex h-full items-center justify-center text-subtle">Preparing episode {episode}…</div>
            ) : streamUrl && player === 'browser' ? (
              streamUrl.includes('.m3u8') || streamUrl.includes('.mp4') ? (
                <video src={streamUrl} controls autoPlay playsInline className="h-full w-full" />
              ) : (
                <iframe src={streamUrl} title={`Episode ${episode}`} allowFullScreen className="h-full w-full border-0" />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-white">{streamError ? 'Playback source unavailable.' : 'No stream available for this episode.'}</p>
                <p className="max-w-md text-sm text-subtle">Try another quality or episode. Unverified provider links are never presented as confirmed playback.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-border bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-subtle">Season 1</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Episode {episode}{currentEpisode?.title ? ` — ${currentEpisode.title}` : ''}</h2>
              </div>
              <div className="flex gap-2">
                <button disabled={currentIndex <= 0} onClick={() => navigateEpisode(episodes[currentIndex - 1].number)} className="rounded-lg border border-border px-3 py-2 text-sm text-white disabled:opacity-40">Previous</button>
                <button disabled={currentIndex < 0 || currentIndex >= episodes.length - 1} onClick={() => navigateEpisode(episodes[currentIndex + 1].number)} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-40">Next</button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-subtle">{currentEpisode?.description || anime.description}</p>
          </div>

          <div className="rounded-2xl border border-border bg-panel p-4">
            <h3 className="font-semibold text-white">Playback</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['browser', 'mpv'] as PlayerType[]).map((value) => (
                <button key={value} onClick={() => setPlayer(value)} className={`rounded-lg border px-3 py-2 text-sm capitalize ${player === value ? 'border-white bg-white text-black' : 'border-border text-subtle'}`}>{value}</button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['1080p', '720p', '480p'] as VideoQuality[]).map((value) => (
                <button key={value} onClick={() => setQuality(value)} className={`rounded-lg border px-2 py-2 text-xs ${quality === value ? 'border-white text-white' : 'border-border text-subtle'}`}>{value}</button>
              ))}
            </div>
            {player === 'mpv' && <a href={streamUrl ?? '#'} className="mt-3 block break-all text-xs text-accent">{streamUrl ?? 'No source URL'}</a>}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">Episodes</h3>
            <span className="text-xs text-subtle">{episodes.length} available</span>
          </div>
          {episodesLoading ? <p className="text-sm text-subtle">Loading episodes…</p> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {episodes.map((item) => (
                <button key={item.id} onClick={() => navigateEpisode(item.number)} className={`rounded-lg border px-3 py-2 text-left text-sm ${item.number === episode ? 'border-white bg-white text-black' : 'border-border bg-surface text-white hover:border-subtle'}`}>
                  <span className="block font-medium">{String(item.number).padStart(2, '0')}</span>
                  {item.title && <span className="mt-1 block truncate text-[10px] opacity-70">{item.title}</span>}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
