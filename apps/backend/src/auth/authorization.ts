import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";

export type AuthenticatedPrincipal = {
  userId: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}

/**
 * Role checks fail closed. The active session middleware populates request.principal
 * only after looking up a non-revoked, unexpired session token hash in PostgreSQL.
 * Never derive the principal or role from request input.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.principal) {
      response.status(401).json({
        data: null,
        error: { code: "UNAUTHENTICATED", message: "Authentication is required" },
      });
      return;
    }

    if (!allowedRoles.includes(request.principal.role)) {
      response.status(403).json({
        data: null,
        error: { code: "FORBIDDEN", message: "You do not have permission to perform this action" },
      });
      return;
    }

    next();
  };
}
