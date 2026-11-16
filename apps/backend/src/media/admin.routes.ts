import { Router } from "express";
import { createReadStream } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import formidable, { type File as FormidableFile } from "formidable";
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

function isSafeFilename(filename: string) {
  return Boolean(filename) && filename.length <= 255 && basename(filename) === filename
    && !filename.includes("/") && !filename.includes(String.fromCharCode(92))
    && !filename.split("").some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
}

async function parseMultipartUpload(request: import("express").Request, maxBytes: number): Promise<{ file: FormidableFile; directory: string }> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "samren-upload-"));
  const form = formidable({
    uploadDir: temporaryDirectory,
    maxFiles: 2,
    maxFields: 1,
    maxFieldsSize: 1024,
    maxFileSize: maxBytes,
    maxTotalFileSize: maxBytes,
    allowEmptyFiles: false,
    minFileSize: 1,
    multiples: false,
    keepExtensions: false,
  });
  try {
    const [fields, files] = await form.parse(request);
    if (Object.keys(fields).length !== 0 || Object.keys(files).length !== 1 || !files.file || files.file.length !== 1) {
      throw new Error("Multipart upload must contain exactly one file field named file");
    }
    return { file: files.file[0], directory: temporaryDirectory };
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function isPayloadTooLarge(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if ("httpCode" in error && error.httpCode === 413) return true;
  return "message" in error && typeof error.message === "string" && error.message.toLowerCase().includes("exceeds");
}

adminMediaRouter.post("/assets/upload", requireTrustedOrigin, async (request, response) => {
  const kind = String(request.get("x-media-kind") ?? "").toUpperCase() as UploadMediaKind;
  if (!Object.hasOwn(allowedMime, kind)) {
    response.status(400).json({ data: null, error: { code: "INVALID_MEDIA_TYPE", message: "The media kind is not supported" } });
    return;
  }

  const maxBytes = MAX_UPLOAD_BYTES[kind];
  const isMultipart = Boolean(request.is("multipart/form-data"));
  const declaredLength = Number(request.get("content-length") ?? 0);
  if (isMultipart && request.get("content-length") !== undefined
    && (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > maxBytes + 64 * 1024)) {
    response.status(413).json({ data: null, error: { code: "UPLOAD_SIZE_INVALID", message: "The multipart upload exceeds the permitted request size" } });
    return;
  }
  if (!isMultipart && request.get("transfer-encoding") === undefined
    && (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > maxBytes)) {
    response.status(413).json({ data: null, error: { code: "UPLOAD_SIZE_INVALID", message: "The upload size is missing or exceeds the limit" } });
    return;
  }

  let filename = String(request.get("x-original-filename") ?? "upload").trim();
  let mime = String(request.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  let multipartFile: FormidableFile | undefined;
  let multipartTempDirectory: string | undefined;
  let stored: Awaited<ReturnType<typeof storeMediaStream>> | undefined;

  try {
    if (isMultipart) {
      const parsedMultipart = await parseMultipartUpload(request, maxBytes);
      multipartFile = parsedMultipart.file;
      multipartTempDirectory = parsedMultipart.directory;
      filename = String(multipartFile.originalFilename ?? "").trim();
      mime = String(multipartFile.mimetype ?? "").split(";")[0].trim().toLowerCase();
      if (!isSafeFilename(filename)) {
        response.status(400).json({ data: null, error: { code: "INVALID_FILENAME", message: "The uploaded filename is invalid" } });
        return;
      }
      if (!allowedMime[kind].includes(mime)) {
        response.status(400).json({ data: null, error: { code: "INVALID_MEDIA_TYPE", message: "The file content type is not supported for this media kind" } });
        return;
      }
      stored = await storeMediaStream(createReadStream(multipartFile.filepath), maxBytes);
    } else {
      if (!isSafeFilename(filename)) {
        response.status(400).json({ data: null, error: { code: "INVALID_FILENAME", message: "The filename is invalid" } });
        return;
      }
      if (!allowedMime[kind].includes(mime)) {
        response.status(400).json({ data: null, error: { code: "INVALID_MEDIA_TYPE", message: "The media kind and content type are not supported" } });
        return;
      }
      stored = await storeMediaStream(request, maxBytes);
    }

    const detected = detectMediaSignature(kind, stored.signature);
    if (!detected || detected.mimeType !== mime) {
      await deleteStoredMedia(stored.storageKey);
      stored = undefined;
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
  } catch (error) {
    if (stored) await deleteStoredMedia(stored.storageKey).catch(() => undefined);
    if (!response.headersSent) {
      const tooLarge = isPayloadTooLarge(error);
      response.status(tooLarge ? 413 : 400).json({
        data: null,
        error: { code: tooLarge ? "UPLOAD_TOO_LARGE" : "UPLOAD_FAILED", message: "The media upload could not be completed" },
      });
    }
  } finally {
    if (multipartTempDirectory) await rm(multipartTempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
});
