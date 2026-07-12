import { createServer } from "node:http";
import { createApp } from "./app.js";
import { closeCache, connectCache } from "./cache.js";
import { config } from "./config.js";
import { pool } from "./db.js";

await connectCache();
const server = createServer(createApp());
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 120_000;
server.listen(config.PORT, "0.0.0.0", () => console.log(`Express ERP API listening on :${config.PORT}`));

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await Promise.allSettled([pool.end(), closeCache()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
