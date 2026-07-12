import pg from "pg";
import { config } from "./config.js";

const { Pool, types } = pg;
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: config.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: 10_000,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  options: `-c statement_timeout=${config.DB_STATEMENT_TIMEOUT_MS}`,
});

pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error", error));

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function sqlIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error("Unsafe SQL identifier");
  return `"${value}"`;
}
