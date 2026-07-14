import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { authRouter } from "./routes/auth.js";
import { schoolsRouter, profileRouter } from "./routes/schools.js";
import { resourceRouter } from "./routes/resources.js";
import { communicationRouter, noticesRouter } from "./routes/communication.js";
import { educationRouter } from "./routes/education.js";
import { learningRouter } from "./routes/learning.js";
import { financeRouter } from "./routes/finance.js";
import { feesRouter } from "./routes/fees.js";
import { opsRouter } from "./routes/ops.js";
import { meetingsRouter } from "./routes/meetings.js";
import { aiRouter } from "./routes/ai.js";
import { academicRoutes } from "./routes/domain/academic.routes.js";
import { cacheStatus } from "./cache.js";
import { config, corsOrigins } from "./config.js";
import { query } from "./db.js";
import { errorHandler, notFound } from "./errors.js";
import type { AuthenticatedRequest } from "./types.js";

export const applicationRouters = [
  { path: "/auth", router: authRouter },
  { path: "/schools", router: schoolsRouter },
  { path: "/profile", router: profileRouter },
  { path: "/communication", router: communicationRouter },
  { path: "/notices", router: noticesRouter },
  { path: "", router: academicRoutes },
  { path: "", router: resourceRouter },
  { path: "", router: educationRouter },
  { path: "", router: learningRouter },
  { path: "", router: feesRouter },
  { path: "", router: financeRouter },
  { path: "", router: meetingsRouter },
  { path: "", router: opsRouter },
  { path: "", router: aiRouter },
] as const;

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(pinoHttp({
    autoLogging: {
      ignore: (req: { method?: string; url?: string }) => req.url === "/health" || req.method === "OPTIONS",
    },
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
      censor: "[REDACTED]",
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customSuccessMessage: (req, res, responseTime) => `${req.method} ${(req as any).originalUrl || req.url} -> ${res.statusCode} (${Math.round(responseTime)} ms)`,
    customErrorMessage: (req, res, error) => `${req.method} ${(req as any).originalUrl || req.url} -> ${res.statusCode} (${error.message})`,
  }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Origin is not allowed"));
    },
    credentials: true,
    exposedHeaders: ["Server-Timing", "X-Process-Time-ms"],
  }));
  app.use(compression({ threshold: 1024 }));
  app.use(cookieParser());
  app.use(express.json({
    limit: "2mb",
    verify(req, _res, buffer) {
      (req as AuthenticatedRequest).rawBody = Buffer.from(buffer);
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use("/uploads", express.static(path.resolve("uploads"), { maxAge: "1d", immutable: false }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    const originalEnd = res.end.bind(res);
    res.end = ((...args: Parameters<Response["end"]>) => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (!res.headersSent) res.setHeader("X-Process-Time-ms", ms.toFixed(1));
      return originalEnd(...args);
    }) as Response["end"];
    next();
  });

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: config.NODE_ENV === "test" ? 10_000 : 50, standardHeaders: "draft-8", legacyHeaders: false });
  app.use("/auth/login", authLimiter);
  app.use("/auth/register-school", authLimiter);
  app.use("/auth/forgot-password", authLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "express-api", version: "10.0.0" }));
  app.get("/ready", async (_req, res) => {
    try {
      await query("SELECT 1");
      if (config.REDIS_REQUIRED && cacheStatus() !== "connected") return res.status(503).json({ detail: "Redis unavailable" });
      res.json({ status: "ready", database: "connected", redis: cacheStatus(), ai_service: config.AI_SERVICE_URL });
    } catch {
      res.status(503).json({ detail: "Database unavailable" });
    }
  });

  for (const { path: mountPath, router } of applicationRouters) {
    if (mountPath) app.use(mountPath, router);
    else app.use(router);
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
