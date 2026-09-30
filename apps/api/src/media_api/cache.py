import json
from typing import Any, Awaitable, Callable, Optional

import redis.asyncio as aioredis

from .config import settings

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> Optional[aioredis.Redis]:
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            await _redis.ping()
        except Exception:
            _redis = None
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def cached_json(key: str, ttl: int, fetch: Callable[[], Awaitable[Any]]) -> Any:
    redis = await get_redis()
    if redis is not None:
        try:
            hit = await redis.get(key)
            if hit is not None:
                return json.loads(hit)
        except Exception:
            pass

    value = await fetch()

    if redis is not None:
        try:
            await redis.set(key, json.dumps(value, default=str), ex=ttl)
        except Exception:
            pass
    return value
