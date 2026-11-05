// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./schema";

const client = new PGlite({ extensions: { btree_gist } });
const db = drizzle({ client, schema });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});

afterAll(async () => {
  await client.close();
});

async function createUserAndClinic(suffix: string) {
  const now = new Date();
  const [user] = await db
    .insert(schema.user)
    .values({
      id: `user-${suffix}`,
      name: "Dana",
      email: `dana-${suffix}@example.test`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const [clinic] = await db
    .insert(schema.organization)
    .values({
      id: `clinic-${suffix}`,
      name: "Dana Reflexology",
      slug: `dana-${suffix}`,
      createdAt: now,
    })
    .returning();
  return { user, clinic };
}

describe("database migrations", () => {
  it("creates the auth and app tables", async () => {
    const { rows } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const tables = rows.map((row) => row.table_name);
    for (const table of [
      "user",
      "session",
      "account",
      "verification",
      "two_factor",
      "organization",
      "member",
      "invitation",
      "rate_limit",
      "clinic_settings",
      "audit_log",
    ]) {
      expect(tables).toContain(table);
    }
  });

  it("stores timestamps with their time zone", async () => {
    const { rows } = await client.query<{
      table_name: string;
      column_name: string;
    }>(
      "select table_name, column_name from information_schema.columns where table_schema = 'public' and data_type = 'timestamp without time zone'",
    );
    expect(rows).toEqual([]);
  });

  it("defaults new clinic settings to Israel and Hebrew", async () => {
    const { clinic } = await createUserAndClinic("defaults");
    const [settings] = await db
      .insert(schema.clinicSettings)
      .values({ clinicId: clinic.id })
      .returning();
    expect(settings.timezone).toBe("Asia/Jerusalem");
    expect(settings.defaultLocale).toBe("he");
  });

  it("rejects a second clinic with the same booking address", async () => {
    await createUserAndClinic("unique");
    await expect(
      db.insert(schema.organization).values({
        id: "clinic-other",
        name: "Other",
        slug: "dana-unique",
        createdAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("keeps audit entries when the clinic is deleted", async () => {
    const { user, clinic } = await createUserAndClinic("audit");
    await db.insert(schema.auditLog).values({
      clinicId: clinic.id,
      actorId: user.id,
      action: "clinic.created",
    });
    await db
      .delete(schema.organization)
      .where(eq(schema.organization.id, clinic.id));

    const entries = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.actorId, user.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].clinicId).toBeNull();
  });

  it("deletes clinic settings with the clinic", async () => {
    const { clinic } = await createUserAndClinic("cascade");
    await db.insert(schema.clinicSettings).values({ clinicId: clinic.id });
    await db
      .delete(schema.organization)
      .where(eq(schema.organization.id, clinic.id));
    const rows = await db
      .select()
      .from(schema.clinicSettings)
      .where(eq(schema.clinicSettings.clinicId, clinic.id));
    expect(rows).toEqual([]);
  });
});
