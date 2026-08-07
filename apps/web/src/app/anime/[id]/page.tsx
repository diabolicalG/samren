'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAnime, useEpisodes, useStreamUrl } from '@samren/hooks';
import {
  EpisodeList,
  RatingBadge,
  PlayerSelector,
  QualitySelector,
  DownloadEpisode,
} from '@samren/ui';
import { PlayCircle, Calendar, Clock, Tv2, Film } from 'lucide-react';
import { PlayerType, VideoQuality } from '@samren/types';

const STATUS_LABELS: Record<string, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  released: 'Released',
  tba: 'TBA',
};

const TYPE_ICONS: { [key: string]: React.ReactNode } = {
  tv: <Tv2 size={16} />,
  movie: <Film size={16} />,
  ova: <Film size={16} />,
  special: <Film size={16} />,
  ona: <Tv2 size={16} />,
  music: <Film size={16} />,
};

export default function AnimeDetailPage() {
  const params = useParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const animeId = rawId as string | undefined;
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [quality, setQuality] = useState<VideoQuality>('1080p');
  const [player, setPlayer] = useState<PlayerType>('browser');

  const { data: animeData, isLoading: animeLoading } = useAnime(animeId ?? '');
  const { data: episodesData, isLoading: episodesLoading } = useEpisodes(animeId ?? '');
  const { data: streamData, isLoading: streamLoading } = useStreamUrl(
    animeId ?? '',
    selectedEpisode,
    quality,
  );

  const anime = animeData?.data;
  const episodes = episodesData?.data ?? [];

  useEffect(() => {
    if (episodes.length > 0 && (!selectedEpisode || selectedEpisode > episodes.length)) {
      setSelectedEpisode(episodes[0].number);
    }
  }, [episodes, selectedEpisode]);

  if (animeLoading) {
    return <div className="p-6 text-gray-400">Loading anime...</div>;
  }

  if (!anime) {
    return <div className="p-6 text-red-500">Anime not found.</div>;
  }

  const streamUrl = streamData?.data?.streamUrl;

  const handleDownload = async (q: VideoQuality) => {
    setQuality(q);
    if (anime && episodes.length > 0) {
      const episode = episodes.find((e) => e.number === selectedEpisode) ?? episodes[0];
      console.log('Queueing download', { animeId: anime.id, episodeId: episode.id, quality: q });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 p-6">
      <div className="space-y-4">
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
          <img
            src={anime.coverImage}
            alt={anime.title}
            className="w-full h-full object-cover"
          />
          {anime.rating > 0 && (
            <div className="absolute top-2 right-2">
              <RatingBadge rating={anime.rating} maxRating={10} size="md" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <PlayerSelector value={player} onChange={setPlayer} />
          <QualitySelector value={quality} onChange={setQuality} />
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{anime.title}</h1>
          {anime.nativeTitle && (
            <p className="text-sm text-gray-400 mt-1">{anime.nativeTitle}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-300">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>{anime.year || 'TBA'}</span>
            </div>
            <div className="flex items-center gap-1">
              {TYPE_ICONS[anime.type] ?? <Tv2 size={16} />}
              <span>{anime.type.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{anime.duration} min/ep</span>
            </div>
            <span
              className={`px-2 py-0.5 text-xs rounded text-white ${
                anime.status === 'ongoing'
                  ? 'bg-blue-500/20'
                  : anime.status === 'completed'
                    ? 'bg-green-500/20'
                    : 'bg-gray-500/20'
              }`}
            >
              {STATUS_LABELS[anime.status] ?? anime.status}
            </span>
            <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
              {anime.episodes} ep
            </span>
          </div>

          {anime.studios.length > 0 && (
            <p className="text-sm text-gray-400 mt-2">
              Studio: {anime.studios.map((s) => s.name).join(', ')}
            </p>
          )}

          {anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {anime.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="px-3 py-1 text-xs rounded-full bg-gray-800 text-gray-300"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <PlayCircle size={20} />
            EP {selectedEpisode}
          </h2>
          {player === 'browser' && (
            <div className="bg-black rounded-lg aspect-video flex items-center justify-center">
              {streamLoading ? (
                <p className="text-gray-400">Loading stream...</p>
              ) : streamUrl ? (
                streamUrl.includes('.m3u8') || streamUrl.includes('.mp4') ? (
                  <video
                    src={streamUrl}
                    controls
                    className="w-full h-full"
                    autoPlay
                  />
                ) : (
                  <iframe
                    src={streamUrl}
                    title={`Episode ${selectedEpisode} stream`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                )
              ) : (
                <p className="text-gray-400">No stream available for this episode.</p>
              )}
            </div>
          )}
          {player === 'mpv' && (
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-gray-300">
                Open in MPV:{' '}
                <a
                  href={streamUrl ?? '#'}
                  className="text-blue-400 hover:underline break-all"
                >
                  {streamUrl ?? 'No stream URL'}
                </a>
              </p>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Description</h2>
          <p className="text-gray-300 leading-relaxed">{anime.description}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Episodes</h2>
          {episodesLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-gray-800 rounded" />
              ))}
            </div>
          ) : (
            <EpisodeList
              episodes={episodes}
              onEpisodeClick={(ep) => setSelectedEpisode(ep.number)}
            />
          )}
        </div>

        <div className="pt-4 border-t border-gray-800">
          <DownloadEpisode
            animeId={anime.id}
            episodeId={String(episodes[0]?.id ?? '')}
            episodeNumber={selectedEpisode}
            episodeTitle={episodes.find((e) => e.number === selectedEpisode)?.title}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  );
}
