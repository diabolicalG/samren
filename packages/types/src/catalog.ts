export type CatalogAnimeType = "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";
export type CatalogReleaseStatus = "AIRING" | "FINISHED" | "NOT_YET_AIRED" | "CANCELLED";
export type CatalogSeasonName = "WINTER" | "SPRING" | "SUMMER" | "FALL";
export type CatalogAgeRating = "G" | "PG" | "PG_13" | "R" | "R_PLUS" | "RX";

export type CatalogAssetPreview = {
  id: string;
  mimeType: string;
  width: number | null;
  height: number | null;
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
