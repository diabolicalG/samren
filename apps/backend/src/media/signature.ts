export type UploadMediaKind = "POSTER" | "BANNER" | "VIDEO" | "SUBTITLE";

export type DetectedMedia = {
  mimeType: string;
  extension: string;
};

function startsWith(bytes: Buffer, signature: number[]) {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

export function detectMediaSignature(kind: UploadMediaKind, prefix: Buffer): DetectedMedia | null {
  if (prefix.length === 0) return null;

  if (kind === "POSTER" || kind === "BANNER") {
    if (startsWith(prefix, [0xff, 0xd8, 0xff])) return { mimeType: "image/jpeg", extension: "jpg" };
    if (startsWith(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mimeType: "image/png", extension: "png" };
    if (prefix.length >= 12 && prefix.toString("ascii", 0, 4) === "RIFF" && prefix.toString("ascii", 8, 12) === "WEBP") {
      return { mimeType: "image/webp", extension: "webp" };
    }
    if (prefix.length >= 12 && prefix.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(prefix.toString("ascii", 8, 12))) {
      return { mimeType: "image/avif", extension: "avif" };
    }
    return null;
  }

  if (kind === "VIDEO") {
    if (prefix.length >= 12 && prefix.toString("ascii", 4, 8) === "ftyp") {
      return { mimeType: "video/mp4", extension: "mp4" };
    }
    if (startsWith(prefix, [0x1a, 0x45, 0xdf, 0xa3])) return { mimeType: "video/webm", extension: "webm" };
    return null;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(prefix).replace(/^\uFEFF/, "").trimStart();
  } catch {
    return null;
  }
  if (text.startsWith("WEBVTT")) return { mimeType: "text/vtt", extension: "vtt" };
  if (/^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text)) {
    return { mimeType: "application/x-subrip", extension: "srt" };
  }
  if (text.startsWith("[Script Info]")) return { mimeType: "application/x-ass", extension: "ass" };
  return null;
}
