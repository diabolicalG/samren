import asyncio
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy import and_, or_
from sqlmodel import Session, select

from src.main import Download, engine
from scrapers.jikan_client import JikanClient
from scrapers.wco_scraper import WCOStreamScraper

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("samren-download-worker")

POLL_INTERVAL = max(1.0, float(os.getenv("DOWNLOAD_POLL_INTERVAL", "2")))
MAX_CONCURRENT = max(1, int(os.getenv("DOWNLOAD_CONCURRENCY", "2")))
STALE_AFTER = max(300, int(os.getenv("DOWNLOAD_STALE_AFTER", "21600")))
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "/downloads"))
DOWNLOAD_MAX_BYTES = max(1, int(os.getenv("DOWNLOAD_MAX_BYTES", str(5 * 1024 * 1024 * 1024))))


def now() -> datetime:
    return datetime.utcnow()


def claim_job() -> Optional[Download]:
    cutoff = now() - timedelta(seconds=STALE_AFTER)
    with Session(engine) as session:
        statement = (
            select(Download)
            .where(
                or_(
                    Download.status == "queued",
                    and_(
                        Download.status == "downloading",
                        Download.started_at.is_not(None),
                        Download.started_at < cutoff,
                    ),
                )
            )
            .order_by(Download.created_at.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        job = session.exec(statement).first()
        if job is None:
            return None

        job.status = "downloading"
        job.progress = 1
        job.started_at = now()
        job.updated_at = now()
        session.add(job)
        session.commit()
        session.refresh(job)
        return job


def update_job(job_id: str, **values: object) -> None:
    with Session(engine) as session:
        job = session.get(Download, job_id)
        if job is None:
            return
        for key, value in values.items():
            setattr(job, key, value)
        job.updated_at = now()
        session.add(job)
        session.commit()


def resolve_episode_number(episodes: list[dict], episode_id: str) -> Optional[int]:
    # The API stores the Jikan episode ID, not the human episode number.
    for episode in episodes:
        if str(episode.get("mal_id")) == str(episode_id):
            number = episode.get("number")
            return int(number) if isinstance(number, int) else None

    # Compatibility fallback for older queued records that stored episode number.
    if str(episode_id).isdigit():
        candidate = int(episode_id)
        for episode in episodes:
            if episode.get("number") == candidate:
                return candidate
    return None


async def ffmpeg_download(url: str, output: Path, duration_seconds: Optional[float], job_id: str) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        url,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "-fs",
        str(DOWNLOAD_MAX_BYTES),
        "-progress",
        "pipe:1",
        str(output),
    ]
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    assert process.stdout is not None
    assert process.stderr is not None

    async def consume_stderr() -> bytes:
        return await process.stderr.read()

    stderr_task = asyncio.create_task(consume_stderr())
    last_progress = 0

    try:
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", "replace").strip()
            if not text.startswith("out_time_ms=") or not duration_seconds:
                continue
            try:
                out_time_us = int(text.split("=", 1)[1])
                progress = min(99, max(1, int((out_time_us / 1_000_000) / duration_seconds * 100)))
                if progress >= last_progress + 5:
                    last_progress = progress
                    await asyncio.to_thread(update_job, job_id, progress=progress)
            except ValueError:
                continue

        return_code = await process.wait()
        stderr = (await stderr_task).decode("utf-8", "replace").strip()
        if return_code != 0:
            raise RuntimeError(stderr or f"ffmpeg exited with code {return_code}")
    except BaseException:
        if process.returncode is None:
            process.kill()
            await process.wait()
        raise
    finally:
        if not stderr_task.done():
            stderr_task.cancel()


async def probe_duration(url: str) -> Optional[float]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        url,
    ]
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    stdout, _ = await process.communicate()
    if process.returncode != 0:
        return None
    try:
        return float(stdout.decode().strip())
    except ValueError:
        return None


async def process_job(job: Download, jikan: JikanClient, wco: WCOStreamScraper) -> None:
    output = DOWNLOAD_DIR / f"{job.id}.mp4"

    try:
        episodes_payload = await jikan.fetch_episodes(job.anime_id)
        episodes = episodes_payload.get("data") or []
        episode_number = resolve_episode_number(episodes, job.episode_id)
        if episode_number is None:
            raise RuntimeError(
                f"Could not resolve episode_id={job.episode_id} to an episode number"
            )

        stream = await wco.extract_stream_url(
            job.anime_id,
            episode_number,
            job.quality,
            jikan_client=jikan,
        )
        if not stream.verified:
            raise RuntimeError("No verified stream source was available for this download")

        duration = await probe_duration(stream.url)
        await ffmpeg_download(stream.url, output, duration, job.id)

        if not output.exists() or output.stat().st_size == 0:
            raise RuntimeError("ffmpeg completed without producing a non-empty file")

        update_job(
            job.id,
            status="completed",
            progress=100,
            file_size=output.stat().st_size,
            path=str(output),
            completed_at=now(),
        )
        logger.info("Download %s completed", job.id)
    except Exception as exc:
        logger.exception("Download %s failed", job.id)
        try:
            output.unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove partial download %s", output)
        update_job(job.id, status="failed", progress=0, completed_at=now(), path="")


async def worker_loop() -> None:
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    jikan = JikanClient()
    wco = WCOStreamScraper()

    async def run_claimed(job: Download) -> None:
        async with semaphore:
            await process_job(job, jikan, wco)

    tasks: set[asyncio.Task[None]] = set()
    try:
        while True:
            while len(tasks) < MAX_CONCURRENT:
                job = await asyncio.to_thread(claim_job)
                if job is None:
                    break
                task = asyncio.create_task(run_claimed(job))
                tasks.add(task)
                task.add_done_callback(tasks.discard)

            if tasks:
                await asyncio.sleep(POLL_INTERVAL)
            else:
                await asyncio.sleep(POLL_INTERVAL)
    finally:
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        await jikan.close()
        await wco.close()


if __name__ == "__main__":
    asyncio.run(worker_loop())
