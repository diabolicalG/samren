import asyncio
from typing import Any, Optional

import httpx

from .config import settings

_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=settings.http_timeout,
            headers={"User-Agent": "samren-unified-api/1.0"},
            follow_redirects=True,
        )
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def request_json(
    method: str,
    url: str,
    *,
    params: Optional[dict] = None,
    json_body: Optional[dict] = None,
    headers: Optional[dict] = None,
) -> Any:
    last_exc: Exception | None = None
    for attempt in range(settings.http_retries + 1):
        try:
            response = await get_client().request(
                method, url, params=params, json=json_body, headers=headers
            )
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", "1"))
                await asyncio.sleep(min(retry_after, 5))
                continue
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_exc = exc
            if attempt < settings.http_retries:
                await asyncio.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Request failed: {method} {url}") from last_exc
