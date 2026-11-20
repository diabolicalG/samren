import os


class Settings:
    app_name: str = os.getenv("MEDIA_API_APP_NAME", "samren-unified-api")
    tmdb_api_key: str = os.getenv("TMDB_API_KEY", "")
    tmdb_base_url: str = os.getenv("TMDB_BASE_URL", "https://api.themoviedb.org/3").rstrip("/")
    tmdb_image_base: str = os.getenv("TMDB_IMAGE_BASE", "https://image.tmdb.org/t/p").rstrip("/")
    anilist_url: str = os.getenv("ANILIST_URL", "https://graphql.anilist.co")
    tvmaze_base_url: str = os.getenv("TVMAZE_BASE_URL", "https://api.tvmaze.com").rstrip("/")
    http_timeout: float = float(os.getenv("MEDIA_API_HTTP_TIMEOUT", "10"))
    http_retries: int = int(os.getenv("MEDIA_API_HTTP_RETRIES", "2"))
    cache_ttl_search: int = int(os.getenv("MEDIA_API_CACHE_TTL_SEARCH", "300"))
    cache_ttl_detail: int = int(os.getenv("MEDIA_API_CACHE_TTL_DETAIL", "86400"))
    cache_ttl_trending: int = int(os.getenv("MEDIA_API_CACHE_TTL_TRENDING", "900"))
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")


settings = Settings()
