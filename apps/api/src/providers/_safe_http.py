import asyncio
import ipaddress
import os
import socket
from urllib.parse import urlsplit

import httpx

MAX_PROVIDER_RESPONSE_BYTES = 10 * 1024 * 1024


def _allowed_hosts() -> set[str]:
    raw = os.getenv("KUHI_PROVIDER_ALLOWED_HOSTS", "")
    return {host.strip().lower().lstrip(".") for host in raw.split(",") if host.strip()}


def validate_provider_url(value: str) -> None:
    try:
        parsed = urlsplit(str(value))
        host = (parsed.hostname or "").rstrip(".").lower()
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            raise ValueError("Kuhi provider request URL is not permitted")
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".test", ".invalid")):
            raise ValueError("Kuhi provider request host is not permitted")
        try:
            address = ipaddress.ip_address(host)
            if not address.is_global:
                raise ValueError("Kuhi provider request host is not public")
        except ValueError as error:
            if "not public" in str(error):
                raise
        allowed = _allowed_hosts()
        if not allowed or not any(host == item or host.endswith("." + item) for item in allowed):
            raise ValueError("Kuhi provider request host is not allowlisted")
    except (TypeError, AttributeError) as error:
        raise ValueError("Kuhi provider request URL is invalid") from error


async def validate_resolved_host(host: str) -> None:
    try:
        records = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError as error:
        raise ValueError("Kuhi provider host DNS resolution failed") from error
    addresses = {record[4][0] for record in records}
    if not addresses:
        raise ValueError("Kuhi provider host did not resolve")
    for value in addresses:
        try:
            address = ipaddress.ip_address(value.split("%", 1)[0])
        except ValueError as error:
            raise ValueError("Kuhi provider host returned an invalid IP address") from error
        if not address.is_global:
            raise ValueError("Kuhi provider host resolved to a non-public IP address")


class _LimitedStream(httpx.AsyncByteStream):
    def __init__(self, inner: httpx.AsyncByteStream, limit: int):
        self.inner = inner
        self.limit = limit

    async def __aiter__(self):
        total = 0
        async for chunk in self.inner:
            total += len(chunk)
            if total > self.limit:
                raise ValueError("Kuhi provider response exceeded the size limit")
            yield chunk

    async def aclose(self) -> None:
        await self.inner.aclose()


class _GuardedTransport(httpx.AsyncBaseTransport):
    def __init__(self):
        self.inner = httpx.AsyncHTTPTransport(retries=0)

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        validate_provider_url(str(request.url))
        await validate_resolved_host(request.url.host)
        response = await self.inner.handle_async_request(request)
        content_length = response.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_PROVIDER_RESPONSE_BYTES:
                    await response.aclose()
                    raise ValueError("Kuhi provider response exceeded the size limit")
            except ValueError as error:
                if "size limit" in str(error):
                    raise
        response.stream = _LimitedStream(response.stream, MAX_PROVIDER_RESPONSE_BYTES)
        return response

    async def aclose(self) -> None:
        await self.inner.aclose()


class AsyncClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("transport", _GuardedTransport())
        super().__init__(*args, **kwargs)
