import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireTrustedOrigin } from "./session.js";
import { clearSessionCookie, createSession, setSessionCookie } from "./session.js";
import { loginSchema } from "./auth.schemas.js";
import { verifyPassword } from "./password.js";

export const authRouter = Router();

const failedLogins = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

function loginRateLimit(request: import("express").Request, response: import("express").Response, next: import("express").NextFunction) {
  const key = request.ip || request.socket.remoteAddress || "unknown";
  const current = failedLogins.get(key);
  const now = Date.now();
  if (current && current.resetAt > now && current.count >= LOGIN_MAX_FAILURES) {
    response.status(429).json({ data: null, error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } });
    return;
  }
  if (current && current.resetAt <= now) failedLogins.delete(key);
  next();
}

authRouter.get("/session", (request, response) => {
  if (!request.authUser) {
    response.status(401).json({ data: null, error: { code: "UNAUTHENTICATED", message: "Authentication is required" } });
    return;
  }
  response.json({ data: { user: request.authUser }, error: null });
});

authRouter.post("/login", requireTrustedOrigin, loginRateLimit, async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ data: null, error: { code: "VALIDATION_ERROR", message: "Email or password is invalid" } });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, username: true, role: true, passwordHash: true },
    });
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? "scrypt:00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    );
    if (!user || !valid) {
      const key = request.ip || request.socket.remoteAddress || "unknown";
      const current = failedLogins.get(key);
      const now = Date.now();
      failedLogins.set(key, current && current.resetAt > now
        ? { count: current.count + 1, resetAt: current.resetAt }
        : { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      response.status(401).json({ data: null, error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } });
      return;
    }

    failedLogins.delete(request.ip || request.socket.remoteAddress || "unknown");
    const session = await createSession(user.id);
    setSessionCookie(response, session.token);
    response.json({
      data: { user: { id: user.id, email: user.email, username: user.username, role: user.role }, expiresAt: session.expiresAt.toISOString() },
      error: null,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireTrustedOrigin, async (request, response, next) => {
  try {
    if (request.authSessionId) {
      await prisma.refreshToken.update({
        where: { id: request.authSessionId },
        data: { revokedAt: new Date() },
      });
    }
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});
