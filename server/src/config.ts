import "dotenv/config";
import { z } from "zod";

const booleanFromString = z.string().optional().transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanFromString,
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  REDIS_URL: z.string().optional(),
  REDIS_REQUIRED: booleanFromString,
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().default(30),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default("erp_refresh_token"),
  COOKIE_SECURE: booleanFromString,
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:8000"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8001"),
  AI_SERVICE_TOKEN: z.string().min(24),
  EMAIL_OTP_DEBUG: booleanFromString,
  OTP_EXPIRE_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  BBB_URL: z.string().optional(),
  BBB_SECRET: z.string().optional(),
});

export const config = schema.parse(process.env);
export const corsOrigins = config.CORS_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean);
