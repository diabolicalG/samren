import httpx
from typing import Optional, Dict, Any
import logging
import re

logger = logging.getLogger(__name__)


class WCOStreamScraper:
    """Async scraper for extracting video stream URLs from WCOStream and similar providers."""

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.wcostream.org/",
    }

    WCO_BASE_URL = "https://www.wcostream.org"

    # Alternative video hosts used as fallback
    FALLBACK_HOSTS = {
        "360p": "https://stream.crackers.world",
        "480p": "https://stream.crackers.world",
        "720p": "https://stream.crackers.world",
        "1080p": "https://stream.crackers.world",
    }

    def __init__(self, base_url: str = WCO_BASE_URL, timeout: float = 15.0):
        self.base_url = base_url
        self.timeout = timeout

    @staticmethod
    def slugify(title: str) -> str:
        """Convert an anime title into a URL-safe slug.

        Examples:
            "One Piece"              -> "one-piece"
            "Naruto: Shippuden"      -> "naruto-shippuden"
            "My Hero Academia"       -> "my-hero-academia"
        """
        slug = re.sub(r"[^a-zA-Z0-9\s-]", "", title.lower())
        slug = re.sub(r"[\s_]+", "-", slug)
        return slug.strip("-")

    def build_episode_url(self, slug: str, episode: int) -> str:
        """Construct a WCOStream episode page URL from a slug and episode number."""
        return f"{self.base_url}/{slug}-episode-{episode}-english-dubbed/"

    async def extract_wco_embed_link(self, episode_url: str) -> Optional[str]:
        """Extract the WCOStream embed iframe source for a given episode URL.

        Mirrors the conceptual snippet:
            iframe = soup.find('iframe', id='cizgi-film-izle')
        """
        async with httpx.AsyncClient(timeout=self.timeout, headers=self.HEADERS) as client:
            try:
                response = await client.get(episode_url)
            except httpx.HTTPError:
                return None

            if response.status_code != 200:
                logger.warning(
                    "Non-200 status for %s (status=%s)", episode_url, response.status_code
                )
                return None

            html = response.text

        # Parse synchronously (BeautifulSoup is CPU-bound, fast enough to run in-thread)
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Primary: look for the known iframe by ID
        iframe_tag = soup.find("iframe", id="cizgi-film-izle")
        if iframe_tag:
            src = iframe_tag.get("src")
            if src:
                logger.info("Found embed via iframe#id: %s", src)
                return self._resolve_relative_url(src)

        # Fallback patterns: any iframe containing 'embed' or 'player'
        for iframe in soup.find_all("iframe"):
            src = iframe.get("src", "")
            if "embed" in src or "player" in src:
                logger.info("Found embed via fallback iframe: %s", src)
                return self._resolve_relative_url(src)

        # Search for video source tags
        video_tag = soup.find("video")
        if video_tag:
            source = video_tag.find("source")
            if source and source.get("src"):
                logger.info("Found embed via <video><source>: %s", source["src"])
                return self._resolve_relative_url(source["src"])

        # Look for direct .mp4 / .m3u8 / .mkv links in the page
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if href.endswith((".mp4", ".m3u8", ".mkv")):
                logger.info("Found direct video link: %s", href)
                return self._resolve_relative_url(href)

        logger.warning("No embed link found for %s", episode_url)
        return None

    def _resolve_relative_url(self, url: str) -> str:
        """Resolve a possibly-relative URL against the WCOStream base."""
        if url.startswith("http://") or url.startswith("https://"):
            return url
        if url.startswith("//"):
            return f"https:{url}"
        if url.startswith("/"):
            return f"{self.base_url}{url}"
        return f"{self.base_url}/{url}"

    async def extract_stream_url(
        self,
        anime_id: str,
        episode: int,
        quality: str = "1080p",
        slug: Optional[str] = None,
        jikan_client: Optional[Any] = None,
    ) -> Optional[str]:
        """Construct the episode page URL and extract the stream URL.

        ``anime_id`` is normally the Jikan/MAL numeric ID.  If ``slug`` is not
        supplied and ``anime_id`` is numeric, the title is looked up via the
        injected ``jikan_client`` (if provided) and slugified.  When ``anime_id``
        is already a slug it is used directly.
        """
        resolved_slug = slug

        if not resolved_slug:
            if anime_id.isdigit() and jikan_client is not None:
                title = await jikan_client.fetch_title(anime_id)
                if title:
                    resolved_slug = self.slugify(title)
                    logger.info(
                        "Resolved slug '%s' for anime_id %s via Jikan", resolved_slug, anime_id
                    )
            else:
                # Assume anime_id is already a slug (e.g. "one-piece")
                resolved_slug = anime_id

        if not resolved_slug:
            logger.warning("Could not resolve slug for anime_id %s", anime_id)

        # Build a set of candidate episode URLs to try
        episode_url = self.build_episode_url(resolved_slug, episode)
        embed_url = await self.extract_wco_embed_link(episode_url)

        if embed_url:
            return embed_url

        # Fallback to a standard embed URL pattern
        fallback = (
            f"{self.FALLBACK_HOSTS.get(quality, self.FALLBACK_HOSTS['1080p'])}"
            f"/{anime_id}/{episode}/{quality}"
        )
        logger.warning("Using fallback stream URL: %s", fallback)
        return fallback
