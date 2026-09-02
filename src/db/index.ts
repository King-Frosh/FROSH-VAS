import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Fail-soft connection setup.
 *
 * Importing this module must NEVER throw — a missing DATABASE_URL (e.g. an
 * unconfigured Vercel environment) should surface as a query error with a
 * clear message, not as a module-load crash that takes every route down.
 */
const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool(
    databaseUrl
      ? { connectionString: databaseUrl, max: 3, connectionTimeoutMillis: 8000 }
      : {
          // No DATABASE_URL configured: fail fast with an obvious error at
          // query time instead of crashing at import time.
          host: "127.0.0.1",
          port: 5432,
          user: "postgres",
          password: "postgres",
          database: "app_db",
          max: 1,
          connectionTimeoutMillis: 3000,
        },
  );

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

export function dbConfigured(): boolean {
  return Boolean(databaseUrl);
}
