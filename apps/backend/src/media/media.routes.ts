import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { openStoredMediaFile } from "./storage.js";
import { convertSrtToWebVtt } from "./subtitles.js";

export const mediaRouter = Router();
const idSchema = z.string().min(1).max(64);
const rangeSchema = /^bytes=([0-9]*)-([0-9]*)$/;
type OpenedMedia = NonNullable<Awaited<ReturnType<typeof openStoredMediaFile>>>;

async function closeStored(stored: OpenedMedia) {
  await stored.handle.close().catch(() => undefined);
}

function parseByteRange(value: string, size: number): { start: number; end: number } | null {
  if (size <= 0) return null;
  const match = rangeSchema.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  try {
    const fileSize = BigInt(size);
    if (!match[1]) {
      const suffix = BigInt(match[2]);
      if (suffix <= 0n) return null;
      return { start: suffix >= fileSize ? 0 : size - Number(suffix), end: size - 1 };
    }
    const startValue = BigInt(match[1]);
    const endValue = match[2] ? BigInt(match[2]) : fileSize - 1n;
    if (startValue >= fileSize || endValue < startValue) return null;
    return { start: Number(startValue), end: Number(endValue >= fileSize ? fileSize - 1n : endValue) };
  } catch {
    return null;
  }
}

async function deliverWebVttSubtitle(request: import("express").Request, response: import("express").Response) {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) return response.status(404).end();

  let stored: OpenedMedia | null = null;
  try {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: parsedId.data,
        processingState: "READY",
        subtitleTracks: {
          some: {
            format: { in: ["SRT", "VTT"] },
            episode: { publicationStatus: "PUBLISHED", anime: { publicationStatus: "PUBLISHED" } },
          },
        },
      },
      select: { storageKey: true, mimeType: true, sizeBytes: true },
    });
    if (!asset || !["application/x-subrip", "text/srt", "text/vtt"].includes(asset.mimeType)) {
      return response.status(404).end();
    }

    stored = await openStoredMediaFile(asset.storageKey);
    if (!stored) return response.status(404).end();
    const expectedSize = Number(asset.sizeBytes);
    if (!Number.isSafeInteger(expectedSize) || expectedSize !== stored.sizeBytes) {
      await closeStored(stored); stored = null;
      return response.status(404).end();
    }
    if (stored.sizeBytes > 2 * 1024 * 1024) {
      await closeStored(stored); stored = null;
      return response.status(413).end("Subtitle exceeds the playback size limit");
    }

    let original: Buffer;
    try {
      original = await stored.handle.readFile();
    } finally {
      await closeStored(stored);
      stored = null;
    }

    let body: Buffer;
    if (asset.mimeType === "text/vtt") body = original;
    else {
      try {
        body = Buffer.from(convertSrtToWebVtt(original.toString("utf8")), "utf8");
      } catch {
        return response.status(422).end("Subtitle file is not valid SubRip");
      }
    }

    response.set({
      "Content-Type": "text/vtt; charset=utf-8",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    response.status(200);
    if (request.method === "HEAD") return response.end();
    return response.end(body);
  } catch {
    if (stored) await closeStored(stored);
    return response.status(500).end();
  }
}

async function deliverMedia(request: import("express").Request, response: import("express").Response) {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) return response.status(404).end();

  let stored: OpenedMedia | null = null;
  try {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: parsedId.data,
        processingState: "READY",
        OR: [
          { posterFor: { some: { publicationStatus: "PUBLISHED" } } },
          { bannerFor: { some: { publicationStatus: "PUBLISHED" } } },
          { episodeMedia: { some: { episode: { publicationStatus: "PUBLISHED", anime: { publicationStatus: "PUBLISHED" } } } } },
          { subtitleTracks: { some: { episode: { publicationStatus: "PUBLISHED", anime: { publicationStatus: "PUBLISHED" } } } } },
        ],
      },
      select: { storageKey: true, mimeType: true, checksumSha256: true, sizeBytes: true },
    });
    if (!asset) return response.status(404).end();

    stored = await openStoredMediaFile(asset.storageKey);
    if (!stored) return response.status(404).end();

    const expectedSize = Number(asset.sizeBytes);
    if (!Number.isSafeInteger(expectedSize) || expectedSize !== stored.sizeBytes || stored.sizeBytes <= 0) {
      await closeStored(stored); stored = null;
      return response.status(404).end();
    }

    const size = stored.sizeBytes;
    let start = 0;
    let end = size - 1;
    let partial = false;
    const range = request.get("range");
    if (range) {
      const parsedRange = parseByteRange(range, size);
      if (!parsedRange) {
        await closeStored(stored); stored = null;
        return response.status(416).set("Content-Range", `bytes */${size}`).end();
      }
      start = parsedRange.start;
      end = parsedRange.end;
      partial = true;
    }

    response.set({
      "Content-Type": asset.mimeType,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    if (asset.checksumSha256) response.set("ETag", `"${asset.checksumSha256}"`);
    if (partial) response.status(206).set("Content-Range", `bytes ${start}-${end}/${size}`);
    else response.status(200);

    if (request.method === "HEAD") {
      await closeStored(stored); stored = null;
      return response.end();
    }

    const stream = stored.handle.createReadStream({ start, end, autoClose: true });
    stored = null;
    stream.on("error", () => {
      if (!response.headersSent) response.status(404).end();
      else response.destroy();
    });
    return stream.pipe(response);
  } catch {
    if (stored) await closeStored(stored);
    return response.status(500).end();
  }
}

mediaRouter.route("/:id/vtt").head(deliverWebVttSubtitle).get(deliverWebVttSubtitle);
mediaRouter.route("/:id").head(deliverMedia).get(deliverMedia);
