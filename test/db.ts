// Helpers for tests that run the real data access code against an
// in-memory Postgres (PGlite) with all migrations applied.
//
// Use from a test file:
//   vi.mock("@/db", async () => ({ db: await (await import("@/test/db")).createTestDb() }));
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import type { ClinicContext } from "@/lib/dal/context";

export async function createTestDb() {
  const db = drizzle({
    client: new PGlite({ extensions: { btree_gist } }),
    schema,
  });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Inserts a practitioner and their clinic, and returns the context the DAL expects. */
export async function makeClinic(
  db: unknown,
  suffix: string,
  timezone = "Asia/Jerusalem",
): Promise<ClinicContext> {
  const testDb = db as TestDb;
  const now = new Date();
  await testDb.insert(schema.user).values({
    id: `user-${suffix}`,
    name: `Practitioner ${suffix}`,
    email: `${suffix}@example.test`,
    createdAt: now,
    updatedAt: now,
  });
  await testDb.insert(schema.organization).values({
    id: `clinic-${suffix}`,
    name: `Clinic ${suffix}`,
    slug: `clinic-${suffix}`,
    createdAt: now,
  });
  return {
    user: {
      id: `user-${suffix}`,
      name: `Practitioner ${suffix}`,
      email: `${suffix}@example.test`,
      twoFactorEnabled: true,
    },
    clinic: {
      id: `clinic-${suffix}`,
      name: `Clinic ${suffix}`,
      slug: `clinic-${suffix}`,
      role: "owner",
      timezone,
    },
  };
}
