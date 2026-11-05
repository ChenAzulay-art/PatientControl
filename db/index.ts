import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const MISSING_URL =
  "DATABASE_URL is not set. Use `npm run dev:local` for a local database, or pull Neon's URL with `vercel env pull .env.local`.";

const globalForDb = globalThis as unknown as { __db?: Database };

function createDatabase(): Database {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
  });

  if (!connectionString) {
    // Importing this module must not need a database (e.g. during `next build`),
    // so a missing URL only fails when a query actually runs.
    pool.connect = (() =>
      Promise.reject(new Error(MISSING_URL))) as Pool["connect"];
  } else {
    // On Vercel, closes idle connections before a function instance is suspended.
    attachDatabasePool(pool);
  }
  return drizzle({ client: pool, schema });
}

// Reuse one pool across hot reloads in development.
export const db: Database = globalForDb.__db ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
