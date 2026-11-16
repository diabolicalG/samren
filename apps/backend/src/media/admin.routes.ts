import { Router } from "express";
import { basename } from "node:path";
import { prisma } from "../db/prisma.js";
import { requireRole } from "../auth/authorization.js";
import { requireTrustedOrigin } from "../auth/session.js";
import { deleteStoredMedia, storeMediaStream } from "./storage.js";
import { detectMediaSignature, type UploadMediaKind } from "./signature.js";

export const adminMediaRouter = Router();
adminMediaRouter.use(requireRole("ADMIN"));

const MAX_UPLOAD_BYTES: Record<UploadMediaKind, number> = { POSTER: 15 * 1024 * 1024, BANNER: 15 * 1024 * 1024, VIDEO: 2 * 1024 * 1024 * 1024, SUBTITLE: 2 * 1024 * 1024 };
const allowedMime: Record<string, string[]> = {
  POSTER: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  BANNER: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  VIDEO: ["video/mp4", "video/webm"],
  SUBTITLE: ["text/vtt", "application/x-subrip", "application/x-ass"],
};

function signatureMatches(kind: string, mime: string, bytes: Buffer) {
  if (kind === "POSTER" || kind === "BANNER") {
    if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (mime === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (mime === "image/avif") return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp" && /^(avif|avis)$/.test(bytes.toString("ascii", 8, 12));
  }
  if (kind === "VIDEO") {
    if (mime === "video/mp4") return bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp";
    if (mime === "video/webm") return bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  }
  if (kind === "SUBTITLE") {
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "").trimStart();
    if (mime === "text/vtt") return text.startsWith("WEBVTT");
    if (mime === "application/x-subrip") return /^\d+\s*\r?\n\d{2}:\d{2}:\d{2},\d{3}/.test(text);
    if (mime === "application/x-ass") return text.startsWith("[Script Info]");
  }
  return false;
}

adminMediaRouter.post("/assets/upload", requireTrustedOrigin, async (request, response) => {
  const kind = String(request.get("x-media-kind") ?? "").toUpperCase() as UploadMediaKind;
  const mime = String(request.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const filename = String(request.get("x-original-filename") ?? "upload").trim();
  const declaredLength = Number(request.get("content-length") ?? 0);

  if (!(kind in allowedMime) || !allowedMime[kind].includes(mime)) {
    response.status(400).json({ data: null, error: { code: "INVALID_MEDIA_TYPE", message: "The media kind and content type are not supported" } });
    return;
  }
  if (!filename || filename.length > 255 || basename(filename) !== filename || /[\\\\/\\0]/.test(filename)) {
    response.status(400).json({ data: null, error: { code: "INVALID_FILENAME", message: "The filename is invalid" } });
    return;
  }
  const maxBytes = MAX_UPLOAD_BYTES[kind];
  if (request.get("transfer-encoding") === undefined && (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > maxBytes)) {
    response.status(413).json({ data: null, error: { code: "UPLOAD_SIZE_INVALID", message: "The upload size is missing or exceeds the limit" } });
    return;
  }

  let stored: Awaited<ReturnType<typeof storeMediaStream>> | undefined;
  try {
    stored = await storeMediaStream(request, maxBytes);
    const detected = detectMediaSignature(kind, stored.signature);
    if (!detected || detected.mimeType !== mime) {
      await deleteStoredMedia(stored.storageKey);
      response.status(415).json({ data: null, error: { code: "FILE_SIGNATURE_MISMATCH", message: "The uploaded file content does not match its declared media type" } });
      return;
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        storageKey: stored.storageKey,
        originalFilename: filename,
        mediaKind: kind as "POSTER" | "BANNER" | "VIDEO" | "SUBTITLE",
        mimeType: mime,
        sizeBytes: BigInt(stored.sizeBytes),
        checksumSha256: stored.checksumSha256,
        processingState: "READY",
      },
      select: {
        id: true, originalFilename: true, mediaKind: true, mimeType: true,
        sizeBytes: true, checksumSha256: true, processingState: true, createdAt: true,
      },
    });
    response.status(201).json({
      data: { ...asset, sizeBytes: asset.sizeBytes.toString() },
      error: null,
    });
  } catch {
    if (stored) await deleteStoredMedia(stored.storageKey).catch(() => undefined);
    if (!response.headersSent) {
      response.status(400).json({ data: null, error: { code: "UPLOAD_FAILED", message: "The media upload could not be completed" } });
    }
  }
});
