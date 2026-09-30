'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Film,
  ListVideo,
  Monitor,
  Play,
  RotateCcw,
  Tv2,
  Volume2,
} from 'lucide-react';
import { useAnime, useEpisodes, useStreamUrl } from '@samren/hooks';
import {
  DownloadEpisode,
  EpisodeList,
  PlayerSelector,
  QualitySelector,
  RatingBadge,
} from '@samren/ui';
import { createDownload } from '@samren/api-client';
import { PlayerType, VideoQuality } from '@samren/types';

const STATUS_LABELS: Record<string, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  released: 'Released',
  tba: 'TBA',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  tv: <Tv2 size={14} />,
  movie: <Film size={14} />,
  ova: <Film size={14} />,
  special: <Film size={14} />,
  ona: <Tv2 size={14} />,
  music: <Film size={14} />,
};

export default function AnimeDetailPage() {
  const params = useParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const animeId = rawId as string | undefined;

  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [player, setPlayer] = useState<PlayerType>('browser');
  const [showEpisodeList, setShowEpisodeList] = useState(false);

  const { data: animeData, isLoading: animeLoading } = useAnime(animeId ?? '');
  const { data: episodesData, isLoading: episodesLoading } = useEpisodes(animeId ?? '');

  const anime = animeData?.data;
  const episodes = episodesData?.data ?? [];

  const selectedEpisodeData = useMemo(
    () => episodes.find((episode) => episode.number === selectedEpisode),
    [episodes, selectedEpisode],
  );

  const selectedIndex = useMemo(
    () => episodes.findIndex((episode) => episode.number === selectedEpisode),
    [episodes, selectedEpisode],
  );

  const previousEpisode = selectedIndex > 0 ? episodes[selectedIndex - 1] : undefined;
  const nextEpisode =
    selectedIndex >= 0 && selectedIndex < episodes.length - 1
      ? episodes[selectedIndex + 1]
      : undefined;

  const { data: streamData, isLoading: streamLoading, error: streamError } = useStreamUrl(
    animeId ?? '',
    selectedEpisodeData?.number ?? 0,
    quality,
    { enabled: !episodesLoading && !!selectedEpisodeData },
  );

  useEffect(() => {
    if (episodes.length > 0 && !episodes.some((episode) => episode.number === selectedEpisode)) {
      setSelectedEpisode(episodes[0].number);
    }
  }, [episodes, selectedEpisode]);

  if (animeLoading) {
    return <main className="min-h-screen bg-[#080c13] p-6 text-gray-400">Loading anime...</main>;
  }

  if (!anime) {
    return <main className="min-h-screen bg-[#080c13] p-6 text-red-400">Anime not found.</main>;
  }

  const streamUrl = streamData?.data?.streamUrl;

  const selectEpisode = (episodeNumber: number) => {
    setSelectedEpisode(episodeNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownload = async (q: VideoQuality) => {
    setQuality(q);
    if (!selectedEpisodeData) return;

    await createDownload({
      animeId: anime.id,
      episodeId: selectedEpisodeData.id,
      quality: q,
    });
  };

  return (
    <main className="min-h-screen bg-[#080c13] text-white">
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-10 blur-2xl"
          style={{ backgroundImage: 'url(' + anime.coverImage + ')' }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080c13]/30 via-[#080c13]/90 to-[#080c13]" />

        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#7440ff]">
                Watch experience
              </p>
              <h1 className="mt-1 text-lg font-semibold sm:text-xl">{anime.title}</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowEpisodeList((value) => !value)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#12121b]/90 px-3 py-2 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/10 lg:hidden"
            >
              <ListVideo size={16} />
              Episodes
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
            <div className="relative aspect-video">
              {player === 'browser' ? (
                streamLoading ? (
                  <div className="flex h-full items-center justify-center bg-[#0b0e16]">
                    <div className="text-center">
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#7440ff]" />
                      <p className="text-sm text-gray-400">Preparing the stream...</p>
                    </div>
                  </div>
                ) : streamUrl ? (
                  streamUrl.includes('.m3u8') || streamUrl.includes('.mp4') ? (
                    <video key={streamUrl} src={streamUrl} controls className="h-full w-full bg-black" autoPlay />
                  ) : (
                    <iframe
                      key={streamUrl}
                      src={streamUrl}
                      title={'Episode ' + selectedEpisode + ' stream'}
                      className="h-full w-full"
                      allowFullScreen
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center bg-[#0b0e16] px-6">
                    <div className="text-center">
                      <AlertTriangle className="mx-auto mb-3 text-yellow-400" size={28} />
                      <p className="text-sm text-gray-300">No playable stream is available.</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center bg-[#0b0e16] p-6">
                  <div className="max-w-xl rounded-xl border border-white/10 bg-[#12121b] p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Monitor size={16} className="text-[#7440ff]" />
                      Open in MPV
                    </div>
                    <a href={streamUrl ?? '#'} className="break-all text-sm text-[#a98cff] hover:underline">
                      {streamUrl ?? 'No stream URL'}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-[#0e1119] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    E{selectedEpisode} {selectedEpisodeData?.title ?? ''}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{anime.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!previousEpisode}
                    onClick={() => previousEpisode && selectEpisode(previousEpisode.number)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!nextEpisode}
                    onClick={() => nextEpisode && selectEpisode(nextEpisode.number)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#7440ff] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#8355ff] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PlayerSelector value={player} onChange={setPlayer} />
                <QualitySelector value={quality} onChange={setQuality} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1">
                  <Volume2 size={12} />
                  Browser controls
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1">
                  <Check size={12} />
                  {streamData?.data?.verified ? 'Verified stream' : 'Unverified source'}
                </span>
              </div>
            </div>
          </div>

          {streamError && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Playback error</p>
                <p className="mt-1 text-xs text-red-300/70">
                  {streamError instanceof Error ? streamError.message : 'Something went wrong during playback.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-400/20 px-2 py-1 text-xs hover:bg-red-500/10"
              >
                <RotateCcw size={13} />
                Retry
              </button>
            </div>
          )}

          {streamData?.data && !streamData.data.verified && (
            <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-300/80">
              This source could not be verified as playable. If playback fails, try another quality or player/source option.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <div className="min-w-0 space-y-6">
          <article className="rounded-2xl border border-white/10 bg-[#12121b] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="relative mx-auto w-32 shrink-0 sm:mx-0 sm:w-40">
                <img src={anime.coverImage} alt={anime.title} className="aspect-[2/3] w-full rounded-xl object-cover" />
                {anime.rating > 0 && (
                  <div className="absolute right-2 top-2">
                    <RatingBadge rating={anime.rating} maxRating={10} size="md" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#7440ff]/15 px-2.5 py-1 text-xs text-[#b59cff]">
                    {TYPE_ICONS[anime.type] ?? <Tv2 size={14} />}
                    {anime.type.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                    {STATUS_LABELS[anime.status] ?? anime.status}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                    {anime.episodes} episodes
                  </span>
                </div>

                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{anime.title}</h2>
                {anime.nativeTitle && <p className="mt-1 text-sm text-gray-500">{anime.nativeTitle}</p>}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={14} />
                    {anime.year || 'TBA'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} />
                    {anime.duration} min/ep
                  </span>
                  {anime.studios.length > 0 && <span>Studio: {anime.studios.map((s) => s.name).join(', ')}</span>}
                </div>

                {anime.genres.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {anime.genres.map((genre) => (
                      <span key={genre.id} className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] text-gray-300">
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-5 max-w-3xl text-sm leading-7 text-gray-400">{anime.description}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#12121b] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Episode & watch history</p>
                <h2 className="mt-1 text-lg font-semibold">
                  Episode {selectedEpisode}{selectedEpisodeData?.title ? ' — ' + selectedEpisodeData.title : ''}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEpisodeList((value) => !value)}
                className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 sm:inline-flex"
              >
                <ListVideo size={15} />
                {showEpisodeList ? 'Hide list' : 'Show list'}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/10 p-3">
              <button
                type="button"
                disabled={!previousEpisode}
                onClick={() => previousEpisode && selectEpisode(previousEpisode.number)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <div className="text-center">
                <p className="text-xs text-gray-500">Now watching</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium">
                  <Play size={13} className="fill-current text-[#7440ff]" />
                  Episode {selectedEpisode}
                </p>
              </div>
              <button
                type="button"
                disabled={!nextEpisode}
                onClick={() => nextEpisode && selectEpisode(nextEpisode.number)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30"
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="mt-4">
              {episodesLoading ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="h-9 animate-pulse rounded-lg bg-white/5" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {episodes.map((episode) => {
                      const active = episode.number === selectedEpisode;
                      return (
                        <button
                          key={episode.id}
                          type="button"
                          onClick={() => selectEpisode(episode.number)}
                          className={
                            'rounded-lg border px-2 py-2 text-xs font-medium transition ' +
                            (active
                              ? 'border-[#7440ff] bg-[#7440ff]/20 text-white'
                              : 'border-white/5 bg-black/10 text-gray-400 hover:border-white/15 hover:bg-white/5 hover:text-white')
                          }
                          aria-current={active ? 'true' : undefined}
                        >
                          {String(episode.number).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>

                  {showEpisodeList && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                      <EpisodeList episodes={episodes} onEpisodeClick={(episode) => selectEpisode(episode.number)} />
                    </div>
                  )}
                </>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#12121b] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Download size={18} className="text-[#7440ff]" />
              <div>
                <h2 className="text-base font-semibold">Download episode</h2>
                <p className="text-xs text-gray-500">Choose a quality for this episode.</p>
              </div>
            </div>
            <DownloadEpisode
              animeId={anime.id}
              episodeId={String(selectedEpisodeData?.id ?? '')}
              episodeNumber={selectedEpisode}
              episodeTitle={selectedEpisodeData?.title}
              onDownload={handleDownload}
            />
          </article>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#12121b] p-4">
              <div className="mb-3 flex items-center gap-2">
                <ListVideo size={17} className="text-[#7440ff]" />
                <h2 className="text-sm font-semibold">Episodes</h2>
                <span className="ml-auto text-[11px] text-gray-500">{episodes.length}</span>
              </div>
              {episodesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="h-9 animate-pulse rounded-lg bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto pr-1">
                  <EpisodeList episodes={episodes} onEpisodeClick={(episode) => selectEpisode(episode.number)} />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#12121b] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Playback</p>
              <div className="mt-3 space-y-2 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Player</span>
                  <span className="text-gray-200">{player}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Quality</span>
                  <span className="text-gray-200">{quality}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Stream</span>
                  <span className={streamData?.data?.verified ? 'text-emerald-400' : 'text-yellow-400'}>
                    {streamData?.data?.verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
