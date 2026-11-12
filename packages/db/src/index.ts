import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Runtime client. The app that imports this package provides DATABASE_URL
// (e.g. apps/dashboard/.env.local). Migrations use MIGRATION_URL via drizzle.config.ts.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one connection pool across dev hot reloads instead of opening a new one each time.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client =
  globalForDb.pgClient ??
  postgres(url, {
    prepare: false, // required for Supabase's transaction pooler (port 6543); harmless otherwise
  });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;


export const db = drizzle(client, { schema });
// For scripts (like the worker) that need to exit cleanly.
// Clears the cached client so nothing reuses a closed connection.
export async function closeDb() {
  await client.end();
  globalForDb.pgClient = undefined;
}
export * from "./schema";
export { eq, and, desc, inArray, sql } from "drizzle-orm";
