import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";

const directory = path.resolve("migrations");
await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
const applied = new Set((await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map((row) => row.filename));
for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
  if (applied.has(filename)) continue;
  console.log(`Applying ${filename}`);
  await pool.query(await readFile(path.join(directory, filename), "utf8"));
  await pool.query("INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING", [filename]);
}
await pool.end();
console.log("Database migrations complete");
