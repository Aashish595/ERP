import type { Response } from "express";
import { aiJson, pipeAiStream } from "../ai-client.js";

export class AiService {
  json<T>(path: string, payload: unknown): Promise<T> { return aiJson<T>(path, payload); }
  stream(path: string, payload: unknown, response: Response): Promise<void> { return pipeAiStream(path, payload, response); }
}

export const aiService = new AiService();
