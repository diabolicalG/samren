import ipaddress
import os
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Path, Query

from src.extractor import anilist_query
from src.media_api.config import settings
from src.providers import _race as provider_race

router = APIRouter(prefix="/v1/kuhi", tags=["kuhi"])


def _allowed_stream_hosts() -> set[str]:
    raw = getattr(settings, "kuhi_stream_allowed_hosts", "")
    return {item.strip().lower().lstrip(".") for item in raw.split(",") if item.strip()}


def _safe_stream_url(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 4096:
        return None
    try:
        parsed = urlsplit(value.strip())
        host = (parsed.hostname or "").rstrip(".").lower()
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            return None
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".test", ".invalid")):
            return None
        try:
            address = ipaddress.ip_address(host)
            if not address.is_global:
                return None
        except ValueError:
            pass
        allowed = _allowed_stream_hosts()
        if not allowed or not any(host == item or host.endswith("." + item) for item in allowed):
            return None
        return parsed.geturl()
    except (ValueError, TypeError):
        return None


def _safe_streams(streams: list) -> list[dict]:
    result = []
    for stream in streams if isinstance(streams, list) else []:
        if not isinstance(stream, dict) or stream.get("type") == "embed":
            continue
        url = _safe_stream_url(stream.get("url"))
        if not url:
            continue
        subtitles = []
        for subtitle in stream.get("subtitles") or []:
            if not isinstance(subtitle, dict):
                continue
            subtitle_url = _safe_stream_url(subtitle.get("url"))
            if not subtitle_url:
                continue
            subtitles.append({
                "url": subtitle_url,
                "label": str(subtitle.get("label") or "Subtitle")[:80],
                "language": str(subtitle.get("lang") or subtitle.get("srclang") or "und")[:16],
                "default": bool(subtitle.get("default", False)),
            })
        result.append({
            "url": url,
            "type": str(stream.get("type") or "hls")[:16],
            "quality": str(stream.get("quality") or stream.get("server") or "auto")[:32],
            "provider": str(stream.get("server") or "Kuhi")[:64],
            "audio": stream.get("audio") if stream.get("audio") in ("sub", "dub") else None,
            "subtitles": subtitles,
        })
    return result


def _safe_episode_data(data: dict) -> dict:
    providers = {}
    for name, provider in (data.get("providers") or {}).items():
        if not isinstance(provider, dict):
            continue
        episodes = {}
        for audio in ("sub", "dub"):
            items = (provider.get("episodes") or {}).get(audio, [])
            safe_items = []
            for item in items if isinstance(items, list) else []:
                if not isinstance(item, dict):
                    continue
                number = item.get("number")
                if not isinstance(number, (int, float)) or number < 1:
                    continue
                safe_items.append({
                    "id": str(item.get("id") or number)[:120],
                    "number": number,
                    "title": str(item.get("title") or f"Episode {number}")[:240],
                    "duration": item.get("duration"),
                    "filler": bool(item.get("filler", False)),
                    "audio": audio,
                })
            episodes[audio] = safe_items
        meta = provider.get("meta") or {}
        providers[str(name)[:40]] = {
            "meta": {
                "id": str(meta.get("id") or data.get("anilistId") or "")[:80],
                "title": str(meta.get("title") or "")[:240],
                "source": str(meta.get("source") or name)[:40],
                "matchScore": meta.get("matchScore"),
            },
            "episodes": episodes,
        }
    return {"anilistId": data.get("anilistId"), "source": "native", "providers": providers}


@router.get("/search")
async def search_anime(
    query: str = Query(..., min_length=2, max_length=100),
    page: int = Query(1, ge=1, le=50),
):
    if not getattr(settings, "kuhi_enabled", True):
        raise HTTPException(status_code=503, detail="Kuhi integration is disabled")
    gql = """
    query ($search: String, $page: Int) {
      Page(page: $page, perPage: 20) {
        pageInfo { currentPage total hasNextPage }
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id title { romaji english native } coverImage { large extraLarge }
          format status seasonYear episodes
        }
      }
    }
    """
    try:
        data = await anilist_query(gql, {"search": query.strip(), "page": page})
        page_data = data.get("Page") or {}
        return {
            "page": (page_data.get("pageInfo") or {}).get("currentPage", page),
            "total": (page_data.get("pageInfo") or {}).get("total", 0),
            "hasNextPage": (page_data.get("pageInfo") or {}).get("hasNextPage", False),
            "results": page_data.get("media") or [],
        }
    except Exception:
        raise HTTPException(status_code=502, detail="Kuhi catalogue search is temporarily unavailable") from None


@router.get("/providers")
async def provider_status():
    if not getattr(settings, "kuhi_enabled", True):
        raise HTTPException(status_code=503, detail="Kuhi integration is disabled")
    return provider_race.providers_status()


@router.get("/episodes/{anilist_id}")
async def get_episodes(anilist_id: int = Path(..., ge=1)):
    if not getattr(settings, "kuhi_enabled", True):
        raise HTTPException(status_code=503, detail="Kuhi integration is disabled")
    try:
        data = await provider_race.merged_episodes(anilist_id)
    except Exception:
        raise HTTPException(status_code=502, detail="Kuhi episode discovery is temporarily unavailable") from None
    if not data:
        raise HTTPException(status_code=404, detail="No provider episodes were found")
    return _safe_episode_data(data)


@router.get("/extract/{anilist_id}")
async def extract_episode(
    anilist_id: int,
    episode: int = Query(1, alias="e", ge=1, le=10000),
    audio: str = Query("sub", alias="type", pattern="^(sub|dub)$"),
    provider: str | None = Query(None),
):
    if not getattr(settings, "kuhi_enabled", True):
        raise HTTPException(status_code=503, detail="Kuhi integration is disabled")
    preferred = (provider or "").strip().lower() or None
    if preferred and preferred not in provider_race.RANKING:
        raise HTTPException(status_code=422, detail="Unknown Kuhi provider")
    try:
        raced = await provider_race.race_watch(anilist_id, episode, audio, preferred=preferred)
    except Exception:
        raise HTTPException(status_code=502, detail="Kuhi source resolution is temporarily unavailable") from None
    if not raced:
        raise HTTPException(status_code=404, detail="No sources were found for this episode")
    streams = _safe_streams(raced.get("streams") or [])
    if not streams:
        raise HTTPException(status_code=404, detail="No allowed direct stream URLs were returned")
    return {
        "anilistId": anilist_id,
        "episode": episode,
        "type": audio,
        "provider": str(raced.get("provider") or "")[:40],
        "streams": streams,
    }
