import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { verifyAccessToken } from "../services/token.service.js";

/**
 * Verifies the access token and refreshes request authorization from the
 * current database user instead of trusting the token's role claim.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "AUTH_REQUIRED", "Bearer token is required");
  }

  const tokenPayload = verifyAccessToken(token);
  const currentUser = await prisma.user.findUnique({
    where: { id: tokenPayload.userId },
    select: { id: true, role: true }
  });

  if (!currentUser) {
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired access token");
  }

  req.auth = { userId: currentUser.id, role: currentUser.role };
  next();
}

/** Restricts a route to the current database roles supplied by authenticate. */
export function requireRoles(...roles: Array<"ADMIN" | "TEACHER" | "CLIENT">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
    if (!roles.includes(req.auth.role)) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission for this action");
    }
    next();
  };
}
