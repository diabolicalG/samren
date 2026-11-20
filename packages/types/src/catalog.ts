export type CatalogAnimeType = "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";
export type CatalogReleaseStatus = "AIRING" | "FINISHED" | "NOT_YET_AIRED" | "CANCELLED";
export type CatalogSeasonName = "WINTER" | "SPRING" | "SUMMER" | "FALL";
export type CatalogAgeRating = "G" | "PG" | "PG_13" | "R" | "R_PLUS" | "RX";

export type CatalogAssetPreview = {
  id: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  url?: string;
};

export type CatalogTaxonomyItem = {
  id: string;
  slug: string;
  name: string;
};

export type CatalogSeason = {
  id: string;
  year: number;
  season: CatalogSeasonName;
  label: string | null;
};

export type CatalogAnimeCard = {
  id: string;
  slug: string;
  title: string;
  englishTitle: string | null;
  synopsis: string | null;
  type: CatalogAnimeType;
  releaseStatus: CatalogReleaseStatus;
  releaseYear: number | null;
  releaseSeason: CatalogSeasonName | null;
  ageRating: CatalogAgeRating | null;
  score: number | null;
  featured: boolean;
  posterAsset: CatalogAssetPreview | null;
  genres: Array<{ genre: CatalogTaxonomyItem }>;
  createdAt: string;
};

export type CatalogEpisode = {
  id: string;
  episodeNumber: number;
  absoluteNumber: number | null;
  title: string;
  synopsis: string | null;
  durationSeconds: number | null;
  airDate: string | null;
  isFiller: boolean;
  isRecap: boolean;
};

export type CatalogAnimeDetail = CatalogAnimeCard & {
  nativeTitle: string | null;
  alternateTitles: string[];
  bannerAsset: CatalogAssetPreview | null;
  studios: Array<{ studio: CatalogTaxonomyItem }>;
  seasonGroup: CatalogSeason | null;
  episodes: CatalogEpisode[];
  updatedAt: string;
};

export type CatalogListParams = {
  q?: string;
  type?: CatalogAnimeType;
  status?: CatalogReleaseStatus;
  year?: number;
  season?: CatalogSeasonName;
  genre?: string;
  studio?: string;
  featured?: boolean;
  sort?: "recent" | "title" | "score";
  page?: number;
  pageSize?: number;
};

export type CatalogPage<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type CatalogPublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminAuthUser = {
  id: string;
  email: string;
  username: string;
  role: "USER" | "MODERATOR" | "ADMIN";
};

export type AdminCatalogAnime = {
  id: string;
  slug: string;
  aniListId: number | null;
  title: string;
  englishTitle: string | null;
  nativeTitle: string | null;
  synopsis: string | null;
  type: CatalogAnimeType;
  releaseStatus: CatalogReleaseStatus;
  publicationStatus: CatalogPublicationStatus;
  releaseYear: number | null;
  releaseSeason: CatalogSeasonName | null;
  ageRating: CatalogAgeRating | null;
  score: number | null;
  featured: boolean;
  posterAssetId: string | null;
  bannerAssetId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  genres: Array<{ genre: CatalogTaxonomyItem }>;
  studios: Array<{ studio: CatalogTaxonomyItem }>;
  _count: { episodes: number };
};

export type AdminAnimeWriteInput = {
  slug?: string;
  aniListId?: number | null;
  title?: string;
  englishTitle?: string | null;
  nativeTitle?: string | null;
  alternateTitles?: string[];
  synopsis?: string | null;
  type?: CatalogAnimeType;
  releaseStatus?: CatalogReleaseStatus;
  publicationStatus?: CatalogPublicationStatus;
  releaseYear?: number | null;
  releaseSeason?: CatalogSeasonName | null;
  ageRating?: CatalogAgeRating | null;
  score?: number | null;
  featured?: boolean;
  posterAssetId?: string | null;
  bannerAssetId?: string | null;
  seasonGroupId?: string | null;
  genreSlugs?: string[];
  studioSlugs?: string[];
};

export type AdminCatalogEpisode = CatalogEpisode & {
  animeId: string;
  seasonId: string | null;
  publicationStatus: CatalogPublicationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminMediaAsset = {
  id: string;
  storageKey: string;
  originalFilename: string;
  mediaKind: "POSTER" | "BANNER" | "VIDEO" | "SUBTITLE";
  mimeType: string;
  sizeBytes: string;
  checksumSha256: string | null;
  processingState: "PENDING" | "READY" | "FAILED";
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEpisodeMedia = {
  id: string;
  episodeId: string;
  assetId: string;
  qualityLabel: string | null;
  isDefault: boolean;
  createdAt: string;
  asset: {
    id: string;
    originalFilename: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    processingState: "PENDING" | "READY" | "FAILED";
  };
};

export type AdminSubtitleTrack = {
  id: string;
  episodeId: string;
  assetId: string;
  languageCode: string;
  label: string;
  format: "SRT" | "VTT" | "ASS";
  isDefault: boolean;
  createdAt: string;
  asset: {
    id: string;
    originalFilename: string;
    mimeType: string;
    processingState: "PENDING" | "READY" | "FAILED";
  };
};

export type CatalogPlayback = {
  episode: {
    id: string;
    episodeNumber: number;
    title: string;
    synopsis: string | null;
    durationSeconds: number | null;
  };
  sources: Array<{ id: string; qualityLabel: string | null; isDefault: boolean; mimeType: string; url: string }>;
  subtitles: Array<{ id: string; languageCode: string; label: string; isDefault: boolean; format: "VTT"; url: string }>;
};
