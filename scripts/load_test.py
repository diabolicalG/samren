#!/usr/bin/env python3
"""Small HTTP load harness for Samren.

Example:
  python scripts/load_test.py --base-url http://localhost --users 50 --duration 60

This intentionally exercises cached metadata paths by default. Use --include-stream
only when you explicitly want to measure provider/stream-resolution pressure.
"""
import argparse
import asyncio
import random
import statistics
import time

import httpx


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost")
    parser.add_argument("--users", type=int, default=25)
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--include-stream", action="store_true")
    return parser.parse_args()


async def run_user(client: httpx.AsyncClient, base_url: str, end_at: float, include_stream: bool, results: list):
    paths = [
        "/api/anime/21",
        "/api/anime/21/episodes",
        "/api/search?q=one%20piece&page=1&limit=20",
        "/api/top?page=1&limit=20",
        "/api/schedule",
    ]
    if include_stream:
        paths.append("/api/anime/21/stream/1?quality=720p")

    while time.monotonic() < end_at:
        path = random.choice(paths)
        started = time.perf_counter()
        try:
            response = await client.get(base_url.rstrip("/") + path)
            elapsed_ms = (time.perf_counter() - started) * 1000
            results.append((response.status_code, elapsed_ms))
        except httpx.HTTPError:
            elapsed_ms = (time.perf_counter() - started) * 1000
            results.append(("error", elapsed_ms))


async def main():
    args = parse_args()
    if args.users < 1 or args.duration < 1:
        raise SystemExit("--users and --duration must be positive")

    results = []
    end_at = time.monotonic() + args.duration
    limits = httpx.Limits(max_connections=max(100, args.users * 4), max_keepalive_connections=args.users)
    timeout = httpx.Timeout(15.0)

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        await asyncio.gather(
            *[
                run_user(client, args.base_url, end_at, args.include_stream, results)
                for _ in range(args.users)
            ]
        )

    if not results:
        raise SystemExit("No requests completed")

    latencies = [latency for _, latency in results]
    statuses = {}
    for status, _ in results:
        statuses[status] = statuses.get(status, 0) + 1

    def percentile(values, p):
        ordered = sorted(values)
        index = min(len(ordered) - 1, max(0, int(round((p / 100) * (len(ordered) - 1)))))
        return ordered[index]

    print(f"requests={len(results)}")
    print(f"statuses={statuses}")
    print(f"p50_ms={percentile(latencies, 50):.1f}")
    print(f"p95_ms={percentile(latencies, 95):.1f}")
    print(f"p99_ms={percentile(latencies, 99):.1f}")
    print(f"max_ms={max(latencies):.1f}")
    print(f"mean_ms={statistics.mean(latencies):.1f}")


if __name__ == "__main__":
    asyncio.run(main())
