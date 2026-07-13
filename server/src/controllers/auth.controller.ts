import { createHash, randomInt, randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import { sendEmail } from "../services/email.service.js";
import {
  newRefreshToken,
  refreshCookieOptions,
  requireAuth,
  signAccessToken,
  tokenHash,
} from "../auth.js";
import type { AuthenticatedRequest, AuthUser } from "../types.js";

export const authRouter = Router();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeLogin = (value: string) => value.trim().toLowerCase();
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "school";

const schoolRegistration = z.object({
  school_name: z.string().min(2).max(200),
  school_code: z.string().min(3).max(40).optional().nullable(),
  institution_type: z.string().default("school"),
  school_email: z.email().optional().nullable(),
  school_phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable().default("India"),
  owner_name: z.string().min(2).max(150),
  owner_email: z.email(),
  owner_phone: z.string().optional().nullable(),
  owner_password: z.string().min(6).max(72),
});

async function publicUser(userId: number) {
  const result = await query(
    `SELECT u.id,u.full_name,u.email,u.phone,u.login_id,u.role,u.school_id,u.must_change_password,
            CASE WHEN u.role='TEACHER' THEN t.photo_url ELSE NULL END AS photo_url
     FROM users u LEFT JOIN teachers t ON t.user_id=u.id WHERE u.id=$1 LIMIT 1`,
    [userId],
  );
  return result.rows[0];
}

async function issueAuth(user: AuthUser, req: import("express").Request, res: import("express").Response) {
  const rawRefresh = newRefreshToken();
  const expires = new Date(Date.now() + config.REFRESH_TOKEN_EXPIRE_DAYS * 86_400_000);
  await query(
    `INSERT INTO refresh_tokens(user_id,token_hash,expires_at,user_agent,ip_address)
     VALUES($1,$2,$3,$4,$5)`,
    [user.id, tokenHash(rawRefresh), expires, req.get("user-agent")?.slice(0, 512) ?? null, req.ip?.slice(0, 64) ?? null],
  );
  res.cookie(config.REFRESH_TOKEN_COOKIE_NAME, rawRefresh, refreshCookieOptions());
  const school = user.school_id ? (await query("SELECT * FROM schools WHERE id=$1", [user.school_id])).rows[0] : null;
  return {
    access_token: signAccessToken(user),
    token_type: "bearer",
    expires_in: config.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    refresh_expires_in: config.REFRESH_TOKEN_EXPIRE_DAYS * 86_400,
    user: await publicUser(user.id),
    school,
  };
}

authRouter.post("/register-school", async (req, res) => {
  const payload = schoolRegistration.parse(req.body);
  const email = payload.owner_email.toLowerCase();
  if ((await query("SELECT 1 FROM users WHERE lower(email)=$1", [email])).rowCount) throw new ApiError(400, "Owner email is already registered");
  if (payload.school_code && (await query("SELECT 1 FROM schools WHERE school_code=$1", [normalizeCode(payload.school_code)])).rowCount) {
    throw new ApiError(409, "School code is already taken");
  }
  const otp = String(randomInt(100000, 1_000_000));
  await query("DELETE FROM pending_school_registrations WHERE owner_email=$1", [email]);
  await query(
    `INSERT INTO pending_school_registrations(owner_email,otp_hash,payload_json,expires_at,attempts)
     VALUES($1,$2,$3,NOW()+($4 * interval '1 minute'),0)`,
    [email, sha256(otp), JSON.stringify(payload), config.OTP_EXPIRE_MINUTES],
  );
  if (!config.EMAIL_OTP_DEBUG) {
    await sendEmail({
      to: email,
      subject: "Verify your School ERP registration",
      text: `Your School ERP verification code is ${otp}. It expires in ${config.OTP_EXPIRE_MINUTES} minutes. If you did not request this code, ignore this email.`,
    });
  }
  res.json({
    message: config.EMAIL_OTP_DEBUG ? "OTP generated in development debug mode." : "Verification OTP sent to owner email.",
    owner_email: email,
    expires_in_minutes: config.OTP_EXPIRE_MINUTES,
    debug_otp: config.EMAIL_OTP_DEBUG ? otp : null,
  });
});

authRouter.post("/verify-school-registration", async (req, res) => {
  const input = z.object({ owner_email: z.email(), otp: z.string().min(4).max(10) }).parse(req.body);
  const email = input.owner_email.toLowerCase();
  const pendingResult = await query<any>(
    "SELECT * FROM pending_school_registrations WHERE owner_email=$1 ORDER BY id DESC LIMIT 1",
    [email],
  );
  const pending = pendingResult.rows[0];
  if (!pending) throw new ApiError(400, "No pending school registration found for this email");
  if (new Date(pending.expires_at) < new Date()) {
    await query("DELETE FROM pending_school_registrations WHERE id=$1", [pending.id]);
    throw new ApiError(400, "OTP expired. Please register again to receive a new OTP.");
  }
  if (pending.attempts >= config.OTP_MAX_ATTEMPTS) throw new ApiError(400, "Too many invalid OTP attempts. Please register again.");
  if (pending.otp_hash !== sha256(input.otp.trim())) {
    await query("UPDATE pending_school_registrations SET attempts=attempts+1,updated_at=NOW() WHERE id=$1", [pending.id]);
    throw new ApiError(400, `Invalid OTP. ${Math.max(config.OTP_MAX_ATTEMPTS - pending.attempts - 1, 0)} attempt(s) left.`);
  }
  const payload = schoolRegistration.parse(JSON.parse(pending.payload_json));
  const created = await transaction(async (client) => {
    const baseSlug = slugify(payload.school_name);
    let slug = baseSlug;
    let counter = 1;
    while ((await client.query("SELECT 1 FROM schools WHERE slug=$1", [slug])).rowCount) slug = `${baseSlug}-${++counter}`;
    let schoolCode = payload.school_code ? normalizeCode(payload.school_code) : normalizeCode(payload.school_name).slice(0, 6);
    counter = 1;
    while (!schoolCode || (await client.query("SELECT 1 FROM schools WHERE school_code=$1", [schoolCode])).rowCount) {
      schoolCode = `${normalizeCode(payload.school_name).slice(0, 5) || "SCH"}${++counter}`;
    }
    const school = (await client.query<any>(
      `INSERT INTO schools(name,slug,school_code,institution_type,email,phone,address,city,state,country)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [payload.school_name, slug, schoolCode, payload.institution_type, payload.school_email, payload.school_phone, payload.address, payload.city, payload.state, payload.country],
    )).rows[0];
    const password = await bcrypt.hash(payload.owner_password, 12);
    const user = (await client.query<AuthUser>(
      `INSERT INTO users(school_id,full_name,email,phone,login_id,hashed_password,role,is_active,must_change_password)
       VALUES($1,$2,$3,$4,$5,$6,'SCHOOL_OWNER',true,false)
       RETURNING id,school_id,full_name,email,login_id,role,is_active,must_change_password`,
      [school.id, payload.owner_name, email, payload.owner_phone, normalizeLogin(email), password],
    )).rows[0]!;
    await client.query("DELETE FROM pending_school_registrations WHERE id=$1", [pending.id]);
    return user;
  });
  res.status(201).json(await issueAuth(created, req, res));
});

authRouter.post("/login", async (req, res) => {
  const payload = z.object({
    school_code: z.string().min(2), login_id: z.string().optional().nullable(), email: z.email().optional().nullable(),
    password: z.string().min(1).max(72), selected_role: z.string().optional().nullable(),
  }).parse(req.body);
  const school = (await query<any>("SELECT * FROM schools WHERE school_code=$1 AND is_active=true LIMIT 1", [normalizeCode(payload.school_code)])).rows[0];
  const genericError = new ApiError(401, "Invalid school code, login ID, or password");
  if (!school) throw genericError;
  const login = normalizeLogin(payload.login_id || payload.email || "");
  const result = await query<any>(
    `SELECT id,school_id,full_name,email,login_id,role,is_active,must_change_password,hashed_password
     FROM users WHERE school_id=$1 AND (login_id=$2 OR lower(email)=$2) LIMIT 1`,
    [school.id, login],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(payload.password, user.hashed_password))) throw genericError;
  if (!user.is_active) throw new ApiError(403, "Account is inactive. Contact your school admin.");
  const groups: Record<string, string[]> = {
    ADMIN: ["SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"], TEACHER: ["TEACHER"], STUDENT: ["STUDENT"], PARENT: ["PARENT"],
  };
  const selected = payload.selected_role?.toUpperCase();
  if (selected && groups[selected] && !groups[selected].includes(user.role)) throw new ApiError(403, "Please select the correct portal tab for this account");
  await query("UPDATE users SET last_login_at=NOW(),failed_login_attempts=0 WHERE id=$1", [user.id]);
  delete user.hashed_password;
  res.json(await issueAuth(user, req, res));
});

authRouter.post("/refresh", async (req, res) => {
  const raw = req.cookies?.[config.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
  if (!raw) throw new ApiError(401, "Refresh token is missing");
  const result = await query<any>(
    `SELECT rt.*,u.id AS uid,u.school_id,u.full_name,u.email,u.login_id,u.role,u.is_active,u.must_change_password
     FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id
     WHERE rt.token_hash=$1 AND rt.revoked_at IS NULL AND rt.expires_at>NOW() LIMIT 1`,
    [tokenHash(raw)],
  );
  const stored = result.rows[0];
  if (!stored?.is_active) throw new ApiError(401, "Refresh token is invalid or expired");
  const nextToken = newRefreshToken();
  await transaction(async (client) => {
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO refresh_tokens(user_id,token_hash,expires_at,user_agent,ip_address)
       VALUES($1,$2,NOW()+($3 * interval '1 day'),$4,$5) RETURNING id`,
      [stored.user_id, tokenHash(nextToken), config.REFRESH_TOKEN_EXPIRE_DAYS, req.get("user-agent")?.slice(0,512), req.ip?.slice(0,64)],
    );
    await client.query("UPDATE refresh_tokens SET revoked_at=NOW(),last_used_at=NOW(),replaced_by_token_id=$1 WHERE id=$2", [inserted.rows[0]!.id, stored.id]);
  });
  res.cookie(config.REFRESH_TOKEN_COOKIE_NAME, nextToken, refreshCookieOptions());
  const user: AuthUser = { id: stored.uid, school_id: stored.school_id, full_name: stored.full_name, email: stored.email, login_id: stored.login_id, role: stored.role, is_active: stored.is_active, must_change_password: stored.must_change_password };
  res.json({ access_token: signAccessToken(user), token_type: "bearer", expires_in: config.ACCESS_TOKEN_EXPIRE_MINUTES * 60 });
});

authRouter.post("/logout", async (req, res) => {
  const raw = req.cookies?.[config.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
  if (raw) await query("UPDATE refresh_tokens SET revoked_at=NOW(),last_used_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL", [tokenHash(raw)]);
  res.clearCookie(config.REFRESH_TOKEN_COOKIE_NAME, { path: "/auth" });
  res.json({ message: "Logged out successfully" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const school = user.school_id ? (await query("SELECT * FROM schools WHERE id=$1", [user.school_id])).rows[0] : null;
  res.json({ access_token: signAccessToken(user), token_type: "bearer", expires_in: config.ACCESS_TOKEN_EXPIRE_MINUTES * 60, user: await publicUser(user.id), school });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const payload = z.object({ current_password: z.string().min(1).max(72), new_password: z.string().min(6).max(72) }).parse(req.body);
  const user = (req as AuthenticatedRequest).user;
  const stored = (await query<{ hashed_password: string }>("SELECT hashed_password FROM users WHERE id=$1", [user.id])).rows[0];
  if (!stored || !(await bcrypt.compare(payload.current_password, stored.hashed_password))) throw new ApiError(400, "Current password is incorrect");
  await query("UPDATE users SET hashed_password=$1,must_change_password=false,password_reset_token_hash=NULL,password_reset_expires_at=NULL,updated_at=NOW() WHERE id=$2", [await bcrypt.hash(payload.new_password, 12), user.id]);
  res.json({ message: "Password changed successfully" });
});

authRouter.post("/forgot-password", async (req, res) => {
  const payload = z.object({ school_code: z.string().min(2), login_id: z.string().min(1) }).parse(req.body);
  const token = randomBytes(32).toString("base64url");
  const result = await query<{ id: number; email: string; full_name: string }>(
    `SELECT u.id,u.email,u.full_name FROM users u JOIN schools s ON s.id=u.school_id
     WHERE s.school_code=$1 AND (u.login_id=$2 OR lower(u.email)=$2) AND u.is_active=true LIMIT 1`,
    [normalizeCode(payload.school_code), normalizeLogin(payload.login_id)],
  );
  if (result.rows[0]) await query("UPDATE users SET password_reset_token_hash=$1,password_reset_expires_at=NOW()+($2 * interval '1 minute') WHERE id=$3", [sha256(token), config.OTP_EXPIRE_MINUTES, result.rows[0].id]);
  const resetUrl = `${config.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  if (!config.EMAIL_OTP_DEBUG && result.rows[0]) {
    await sendEmail({
      to: result.rows[0].email,
      subject: "Reset your School ERP password",
      text: `Hello ${result.rows[0].full_name},\n\nUse this link to reset your password:\n${resetUrl}\n\nThe link expires in ${config.OTP_EXPIRE_MINUTES} minutes. If you did not request it, ignore this email.`,
    });
  }
  res.json({
    message: "If this account exists, password reset instructions have been sent to the registered email.",
    reset_token: config.EMAIL_OTP_DEBUG && result.rows[0] ? token : null,
    reset_url: config.EMAIL_OTP_DEBUG && result.rows[0] ? resetUrl : null,
  });
});

authRouter.post("/reset-password", async (req, res) => {
  const payload = z.object({ token: z.string().min(20), new_password: z.string().min(6).max(72) }).parse(req.body);
  const result = await query<{ id: number }>("SELECT id FROM users WHERE password_reset_token_hash=$1 AND password_reset_expires_at>NOW() LIMIT 1", [sha256(payload.token)]);
  if (!result.rows[0]) throw new ApiError(400, "Invalid or expired reset link");
  await transaction(async (client) => {
    await client.query("UPDATE users SET hashed_password=$1,must_change_password=false,password_reset_token_hash=NULL,password_reset_expires_at=NULL WHERE id=$2", [await bcrypt.hash(payload.new_password, 12), result.rows[0]!.id]);
    await client.query("UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", [result.rows[0]!.id]);
  });
  res.json({ message: "Password reset successfully. You can login with your new password." });
});
