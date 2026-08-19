import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, isProduction } from "@/lib/env";

/**
 * The single Postgres connection pool.
 *
 * Extracted from the application store so the admin panel shares one pool
 * rather than opening a second. On a serverless platform every extra pool is
 * multiplied by the number of warm instances, and Postgres connection limits
 * are the classic way a Vercel deployment falls over under load.
 */

let client: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

export function getDb(): PostgresJsDatabase {
  if (db) return db;

  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. The admin panel and persistent storage require a database.",
    );
  }

  client = postgres(env.DATABASE_URL, {
    // Serverless invocations are short-lived and numerous; a large per-instance
    // pool exhausts the server's connection limit rather than helping.
    max: isProduction ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Managed Postgres providers all require TLS. Demanding it in production
    // means a misconfigured URL fails loudly instead of sending children's
    // names across the network in the clear.
    ssl: isProduction ? "require" : undefined,
    // Never let the driver print bound values — they are personal data.
    debug: false,
    // Prepared statements break through connection poolers such as PgBouncer
    // in transaction mode, which most managed providers put in front.
    prepare: false,
  });

  db = drizzle(client);
  return db;
}

/** Used by scripts that must exit cleanly rather than hang on an open pool. */
export async function closeDb(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    db = null;
  }
}
