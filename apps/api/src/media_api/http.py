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
    attempts = settings.http_retries + 1

    for attempt in range(attempts):
        try:
            response = await get_client().request(
                method, url, params=params, json=json_body, headers=headers
            )
            if response.status_code == 429:
                if attempt >= attempts - 1:
                    response.raise_for_status()
                retry_after = response.headers.get("Retry-After")
                try:
                    delay = float(retry_after) if retry_after is not None else 1.0
                except ValueError:
                    delay = 1.0
                await asyncio.sleep(min(max(delay, 0.0), settings.http_retry_max_delay))
                continue

            if 500 <= response.status_code <= 599:
                response.raise_for_status()

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as exc:
            last_exc = exc
            status = exc.response.status_code
            if status < 500 and status != 429:
                raise
            if attempt < attempts - 1:
                await asyncio.sleep(min(
                    settings.http_retry_base_delay * (2 ** attempt),
                    settings.http_retry_max_delay,
                ))
        except (httpx.RequestError, ValueError) as exc:
            last_exc = exc
            if attempt < attempts - 1:
                await asyncio.sleep(min(
                    settings.http_retry_base_delay * (2 ** attempt),
                    settings.http_retry_max_delay,
                ))

    raise RuntimeError(f"Request failed: {method} {url}") from last_exc
