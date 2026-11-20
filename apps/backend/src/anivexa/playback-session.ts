import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";

const COOKIE_NAME = "samren_playback";
const COOKIE_PATH = "/api/v1/anivexa";
const COOKIE_MAX_AGE_SECONDS = 1_800;

function signature(token: string): string {
  return createHmac("sha256", env.PLAYBACK_SESSION_SECRET).update(token).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieValue(request: Pick<Request, "headers">): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) return part.slice(separator + 1).trim();
  }
  return null;
}

export function readPlaybackSessionToken(request: Pick<Request, "headers">): string | null {
  const value = cookieValue(request);
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const token = value.slice(0, separator);
  const suppliedSignature = value.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const expectedSignature = signature(token);
  return constantTimeEqual(suppliedSignature, expectedSignature) ? token : null;
}

export function ensurePlaybackSession(request: Pick<Request, "headers">, response: Pick<Response, "append">): string {
  const existing = readPlaybackSessionToken(request);
  if (existing) return existing;

  const token = randomBytes(32).toString("base64url");
  const attributes = [
    `${COOKIE_NAME}=${token}.${signature(token)}`,
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (env.NODE_ENV === "production") attributes.push("Secure");
  response.append("Set-Cookie", attributes.join("; "));
  return token;
}
