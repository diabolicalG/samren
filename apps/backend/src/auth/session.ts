import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env, isProduction } from "../config/env.js";
import { prisma } from "../db/prisma.js";

export const SESSION_COOKIE = "samren_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string) {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function cookieOptions(maxAgeMs?: number) {
  const options = [
    `${SESSION_COOKIE}=`,
    "Path=/api/v1",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (isProduction) options.push("Secure");
  if (maxAgeMs !== undefined) options.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  return options.join("; ");
}

export function clearSessionCookie(response: Response) {
  response.setHeader("Set-Cookie", cookieOptions(0));
}

export function setSessionCookie(response: Response, token: string) {
  const value = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/api/v1",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isProduction) value.push("Secure");
  response.setHeader("Set-Cookie", value.join("; "));
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function authenticateSession(request: Request, _response: Response, next: NextFunction) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    next();
    return;
  }

  try {
    const session = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: { select: { id: true, role: true, email: true, username: true } },
      },
    });

    if (session) {
      request.principal = { userId: session.user.id, role: session.user.role };
      request.authSessionId = session.id;
      request.authUser = session.user;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireTrustedOrigin(request: Request, response: Response, next: NextFunction) {
  const origin = request.get("origin");
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowedOrigins.includes(origin)) {
    response.status(403).json({
      data: null,
      error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed" },
    });
    return;
  }
  next();
}

declare global {
  namespace Express {
    interface Request {
      authSessionId?: string;
      authUser?: { id: string; role: "USER" | "MODERATOR" | "ADMIN"; email: string; username: string };
    }
  }
}
