import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

import { config } from "../config.js";
import { ApiError } from "../errors.js";

export const GOOGLE_OAUTH_COOKIE = "erp_google_oauth";

type GoogleOAuthCookie = {
  type: "google_oauth";
  state: string;
  verifier: string;
  schoolCode: string;
  selectedRole?: UserPortalRole;
};

export type UserPortalRole = "STUDENT" | "TEACHER" | "PARENT";
const USER_PORTAL_ROLES = new Set<UserPortalRole>(["STUDENT", "TEACHER", "PARENT"]);

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function callbackUrl() {
  return config.GOOGLE_CALLBACK_URL || `${config.PUBLIC_API_URL.replace(/\/$/, "")}/auth/google/callback`;
}

function base64UrlSha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function googleFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(502, "Google sign-in is temporarily unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export function isGoogleAuthEnabled() {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
}

export function googleOAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/auth/google",
    maxAge: 10 * 60_000,
  };
}

export function createGoogleAuthorization(schoolCode: string, selectedRole?: UserPortalRole) {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(503, "Google sign-in has not been configured");
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const cookie = jwt.sign(
    { type: "google_oauth", state, verifier, schoolCode, selectedRole } satisfies GoogleOAuthCookie,
    config.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "10m" },
  );

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: base64UrlSha256(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return { authorizationUrl: authorizationUrl.toString(), cookie };
}

export function verifyGoogleAuthorization(cookie: string | undefined, returnedState: string) {
  if (!cookie || !returnedState) throw new ApiError(400, "Google sign-in session expired");

  try {
    const payload = jwt.verify(cookie, config.JWT_SECRET, { algorithms: ["HS256"] }) as GoogleOAuthCookie;
    if (
      payload.type !== "google_oauth" ||
      !payload.verifier ||
      !payload.schoolCode ||
      (payload.selectedRole && !USER_PORTAL_ROLES.has(payload.selectedRole)) ||
      !safeEqual(payload.state, returnedState)
    ) {
      throw new ApiError(400, "Google sign-in session is invalid");
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Google sign-in session expired");
  }
}

export async function exchangeGoogleAuthorizationCode(code: string, verifier: string) {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(503, "Google sign-in has not been configured");
  }

  const tokenResponse = await googleFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl(),
    }),
  });
  const tokens = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokens.access_token) throw new ApiError(401, "Google could not verify this sign-in");

  const profileResponse = await googleFetch("https://openidconnect.googleapis.com/v1/userinfo", {
    method: "GET",
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => ({}))) as GoogleUserInfo;
  if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) {
    throw new ApiError(401, "A verified Google email address is required");
  }

  return {
    subject: profile.sub,
    email: profile.email.trim().toLowerCase(),
    name: profile.name?.trim() || null,
  };
}
