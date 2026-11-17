import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { readStoredMediaStat } from "./storage.js";
import { convertSrtToWebVtt } from "./subtitles.js";

export const mediaRouter = Router();

const idSchema = z.string().min(1).max(64);
const rangeSchema = /^bytes=([0-9]*)-([0-9]*)$/;

async function deliverWebVttSubtitle(request: import("express").Request, response: import("express").Response) {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(404).end();
    return;
  }
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
      select: { storageKey: true, mimeType: true },
    });
    if (!asset || !["application/x-subrip", "text/srt", "text/vtt"].includes(asset.mimeType)) {
      response.status(404).end();
      return;
    }
    const stored = await readStoredMediaStat(asset.storageKey);
    if (!stored) {
      response.status(404).end();
      return;
    }
    if (stored.sizeBytes > 2 *  1024 * 1024) {
      response.status(413).end("Subtitle exceeds the playback size limit");
      return;
    }
    const original = await readFile(stored.absolutePath);
    let body: Buffer;
    if (asset.mimeType === "text/vtt") body = original;
    else {
      try {
        body = Buffer.from(convertSrtToWebVtt(original.toString("utf8")), "utf8");
      } catch {
        response.status(422).end("Subtitle file is not valid SubRip");
        return;
      }
    }
    response.set({
      "Content-Type": "text/vtt; charset=utf-8",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    response.status(200);
    if (request.method === "HEAD") response.end();
    else response.end(body);
  } catch {
    response.status(500).end();
  }
}

async function deliverMedia(request: import("express").Request, response: import("express").Response) {
  const parsedId = idSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(404).end();
    return;
  }

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
      select: { storageKey: true, mimeType: true, checksumSha256: true },
    });
    if (!asset) {
      response.status(404).end();
      return;
    }

    const stored = await readStoredMediaStat(asset.storageKey);
    if (!stored) {
      response.status(404).end();
      return;
    }

    const size = stored.sizeBytes;
    let start = 0;
    let end = size - 1;
    let partial = false;
    const range = request.get("range");

    if (range) {
      const match = rangeSchema.exec(range);
      if (!match || (!match[1] && !match[2]) || size === 0) {
        response.status(416).set("Content-Range", `bytes */${size}`).end();
        return;
      }
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) {
          response.status(416).set("Content-Range", `bytes */${size}`).end();
          return;
        }
        start = Math.max(size - suffix, 0);
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
        response.status(416).set("Content-Range", `bytes */${size}`).end();
        return;
      }
      end = Math.min(end, size - 1);
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
      response.end();
      return;
    }
    const stream = createReadStream(stored.absolutePath, { start, end });
    stream.on("error", () => {
      if (!response.headersSent) response.status(404).end();
      else response.destroy();
    });
    stream.pipe(response);
  } catch {
    response.status(500).end();
  }
}

mediaRouter.route("/:id/vtt").head(deliverWebVttSubtitle).get(deliverWebVttSubtitle);
mediaRouter.route("/:id").head(deliverMedia).get(deliverMedia);
