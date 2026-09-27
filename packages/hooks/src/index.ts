import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@samren/api-client';
import type { UserPreferences } from '@samren/types';

// --- Anime browsing -----------------------------------------------------

export function useAnimeList(params: api.AnimeListParams = {}) {
  return useQuery({
    queryKey: ['anime-list', params],
    queryFn: () => api.getAnimeList(params),
  });
}

export function useTopAnime(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['top-anime', params],
    queryFn: () => api.getTopAnime(params),
  });
}

export function useAnime(animeId: string) {
  return useQuery({
    queryKey: ['anime', animeId],
    queryFn: () => api.getAnime(animeId),
    enabled: !!animeId,
  });
}

export function useEpisodes(animeId: string) {
  return useQuery({
    queryKey: ['episodes', animeId],
    queryFn: () => api.getEpisodes(animeId),
    enabled: !!animeId,
  });
}

export function useStreamUrl(animeId: string, episode: number, quality: string) {
  return useQuery({
    queryKey: ['stream', animeId, episode, quality],
    queryFn: () => api.getStreamUrl(animeId, episode, quality),
    enabled: !!animeId && !!episode,
  });
}

export function useSearch(
  query: string,
  options: { enabled?: boolean; page?: number; limit?: number } = {},
) {
  const { enabled = true, ...params } = options;
  return useQuery({
    queryKey: ['search', query, params],
    queryFn: () => api.searchAnime(query, params),
    enabled: enabled && query.length > 0,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => api.getGenres(),
    staleTime: 60 * 60 * 1000, // genres barely ever change
  });
}

export function useSchedule(day?: string) {
  return useQuery({
    queryKey: ['schedule', day],
    queryFn: () => api.getSchedule(day),
  });
}

// --- Favorites ------------------------------------------------------

export function useFavorites(userId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => api.getFavorites(userId),
    enabled: !!userId,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ animeId, isFavorite }: { animeId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.addFavorite(userId, animeId);
      } else {
        await api.removeFavorite(userId, animeId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
    },
  });

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    toggleFavorite,
  };
}

// --- History ------------------------------------------------------

export function useHistory(userId: string) {
  return useQuery({
    queryKey: ['history', userId],
    queryFn: () => api.getHistory(userId),
    enabled: !!userId,
  });
}

export function useAddHistory(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      animeId: string;
      episodeId: string;
      episodeNumber: number;
      currentTime: number;
      duration: number;
    }) => api.addHistory(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history', userId] });
    },
  });
}

// --- Downloads ------------------------------------------------------

export function useDownloads(userId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['downloads', userId],
    queryFn: () => api.getDownloads(userId),
    enabled: !!userId,
  });

  const clearCache = useMutation({
    mutationFn: () => api.clearDownloadsCache(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', userId] });
    },
  });

  const createDownload = useMutation({
    mutationFn: (input: { animeId: string; episodeId: string; quality: string }) =>
      api.createDownload(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', userId] });
    },
  });

  return {
    downloads: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    clearCache,
    createDownload,
  };
}

// --- User preferences -------------------------------------------------

export function useUserPreferences(userId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['preferences', userId],
    queryFn: () => api.getUserPreferences(userId),
    enabled: !!userId,
  });

  const updatePreferences = useMutation({
    mutationFn: (updates: Partial<UserPreferences>) =>
      api.updateUserPreferences(userId, updates),
    onSuccess: (data) => {
      queryClient.setQueryData(['preferences', userId], data);
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updatePreferences,
  };
}
