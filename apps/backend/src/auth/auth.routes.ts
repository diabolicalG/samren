import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireTrustedOrigin } from "./session.js";
import { clearSessionCookie, createSession, setSessionCookie } from "./session.js";
import { loginSchema } from "./auth.schemas.js";
import { verifyPassword } from "./password.js";

export const authRouter = Router();

authRouter.get("/session", (request, response) => {
  if (!request.authUser) {
    response.status(401).json({ data: null, error: { code: "UNAUTHENTICATED", message: "Authentication is required" } });
    return;
  }
  response.json({ data: { user: request.authUser }, error: null });
});

authRouter.post("/login", requireTrustedOrigin, async (request, response, next) => {
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
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? "");
    if (!user || !valid) {
      response.status(401).json({ data: null, error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } });
      return;
    }

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
