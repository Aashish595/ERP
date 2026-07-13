import type { Response } from "express";
import { config } from "./config.js";
import { ApiError } from "./errors.js";

export async function aiJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(`${config.AI_SERVICE_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.AI_SERVICE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({ detail: "AI service returned an invalid response" }));
    if (!response.ok) throw new ApiError(response.status === 503 ? 503 : 502, (payload as any).detail || "AI service request failed");
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "AI service is temporarily unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export async function pipeAiStream(path: string, body: unknown, res: Response): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${config.AI_SERVICE_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.AI_SERVICE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new ApiError(502, "AI streaming service is unavailable");
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let parseBuffer = "";
    let answer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
      parseBuffer += decoder.decode(value, { stream: true });
      const events = parseBuffer.split("\n\n");
      parseBuffer = events.pop() ?? "";
      for (const event of events) {
        const line = event.split("\n").find((item) => item.startsWith("data:"));
        if (!line) continue;
        try {
          const payload = JSON.parse(line.slice(5).trim()) as { token?: unknown };
          if (typeof payload.token === "string") answer += payload.token;
        } catch {
          // Ignore provider keepalive and completion events.
        }
      }
    }
    return answer;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "AI service is temporarily unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
