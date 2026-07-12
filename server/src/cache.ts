import { Redis } from "ioredis";
import { config } from "./config.js";

let redis: Redis | null = null;

export async function connectCache() {
  if (!config.REDIS_URL) return;
  const client = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3_000,
  });
  client.on("error", (error: Error) => console.warn("Redis unavailable; continuing without shared cache", error.message));
  try {
    await client.connect();
    await client.ping();
    redis = client;
  } catch (error) {
    client.disconnect();
    if (config.REDIS_REQUIRED) throw error;
  }
}

export function cacheStatus() {
  return redis?.status === "ready" ? "connected" : "unavailable";
}

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  if (redis) {
    const value = await redis.get(key).catch(() => null);
    if (value) return JSON.parse(value) as T;
  }
  const result = await loader();
  if (redis) await redis.set(key, JSON.stringify(result), "EX", ttlSeconds).catch(() => undefined);
  return result;
}

export async function invalidateSchoolCache(schoolId: number | null) {
  if (!redis || schoolId == null) return;
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `school:${schoolId}:*`, "COUNT", 100);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== "0");
}

export async function closeCache() {
  if (redis) await redis.quit().catch(() => redis?.disconnect());
}
