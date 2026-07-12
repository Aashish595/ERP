import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ detail: "Endpoint not found" });
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(422).json({ detail: error.issues.map((issue) => ({ loc: issue.path, msg: issue.message, type: issue.code })) });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ detail: error.message, ...(error.details ? { errors: error.details } : {}) });
    return;
  }
  const pgError = error as { code?: string; detail?: string };
  if (pgError?.code === "23505") {
    res.status(409).json({ detail: "A record with these details already exists" });
    return;
  }
  if (pgError?.code === "23503") {
    res.status(409).json({ detail: "This record is referenced by other data" });
    return;
  }
  console.error(error);
  res.status(500).json({ detail: "Internal server error" });
};
