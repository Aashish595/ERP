import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { query } from "./db.js";
import { ApiError } from "./errors.js";
import type { AuthenticatedRequest, AuthUser, JwtPayload, UserRole } from "./types.js";

export function signAccessToken(user: AuthUser) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, school_id: user.school_id, type: "access" } satisfies JwtPayload,
    config.JWT_SECRET,
    { algorithm: "HS256", expiresIn: `${config.ACCESS_TOKEN_EXPIRE_MINUTES}m` },
  );
}

export function newRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: "/auth",
    maxAge: config.REFRESH_TOKEN_EXPIRE_DAYS * 86_400_000,
  } as const;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if ((req as Partial<AuthenticatedRequest>).user) return next();
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new ApiError(401, "Not authenticated");
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
    if (payload.type !== "access") throw new ApiError(401, "Invalid token");
    const result = await query<AuthUser>(
      `SELECT id, school_id, full_name, email, login_id, role, is_active, must_change_password
       FROM users WHERE id = $1 LIMIT 1`,
      [Number(payload.sub)],
    );
    const user = result.rows[0];
    if (!user?.is_active) throw new ApiError(401, "Account is inactive");
    const authReq = req as AuthenticatedRequest;
    authReq.user = user;
    const requestedSession = req.header("x-academic-session-id");
    if (requestedSession && /^\d+$/.test(requestedSession)) authReq.academicSessionId = Number(requestedSession);
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(401, "Invalid or expired access token"));
  }
}

export function allowRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!roles.includes(user.role)) return next(new ApiError(403, "You do not have permission to perform this action"));
    next();
  };
}

export function schoolId(req: Request): number {
  const value = (req as AuthenticatedRequest).user.school_id;
  if (value == null) throw new ApiError(403, "A school account is required");
  return value;
}

export async function activeAcademicSessionId(req: Request): Promise<number | null> {
  const authReq = req as AuthenticatedRequest;
  if (authReq.academicSessionId) {
    const found = await query("SELECT id FROM academic_sessions WHERE id=$1 AND school_id=$2", [authReq.academicSessionId, schoolId(req)]);
    if (!found.rowCount) throw new ApiError(400, "Academic session does not belong to this school");
    return authReq.academicSessionId;
  }
  const result = await query<{ id: number }>(
    "SELECT id FROM academic_sessions WHERE school_id=$1 AND is_active=true ORDER BY id DESC LIMIT 1",
    [schoolId(req)],
  );
  return result.rows[0]?.id ?? null;
}
