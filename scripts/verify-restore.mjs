// Checks that a restored copy of the database is complete and readable.
//
//   npm run db:verify-restore -- "postgres://…restored-branch…"
//
// Run it against a Neon branch restored from a past point in time (see
// docs/backups.md), with the same DATA_ENCRYPTION_KEY as production in the
// environment (.env.local is read automatically). It prints counts only,
// never patient details, and exits with an error if anything is wrong.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { decrypt } from "../lib/crypto.ts";

const url = process.argv[2] || process.env.RESTORE_DATABASE_URL;
if (!url) {
  console.error(
    "Usage: npm run db:verify-restore -- <connection string of the restored database>",
  );
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const problems = [];

try {
  // 1. Every migration the code expects has been applied.
  const journal = JSON.parse(
    await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url)),
  );
  const { rows: applied } = await client.query(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  const expected = journal.entries.length;
  console.log(`Migrations: ${applied[0].n} of ${expected}`);
  if (applied[0].n < expected) problems.push("missing migrations");

  // 2. How much is there, and how recent it is.
  const tables = [
    "organization",
    "user",
    "patients",
    "appointments",
    "session_notes",
    "session_note_versions",
    "notifications",
    "audit_log",
  ];
  for (const table of tables) {
    const { rows } = await client.query(
      `select count(*)::int as n from "${table}"`,
    );
    console.log(`${table.padEnd(22)} ${rows[0].n}`);
  }
  const { rows: latest } = await client.query(
    "select max(created_at) as at from audit_log",
  );
  console.log(`Newest audit entry: ${latest[0].at?.toISOString() ?? "none"}`);

  // 3. The encrypted fields open with this key. Without the right key a
  //    restore is useless, so this is the part that matters most.
  const sealed = [
    [
      "patients",
      [
        "national_id_encrypted",
        "medical_background_encrypted",
        "important_notes_encrypted",
      ],
    ],
    ["session_notes", ["body_encrypted"]],
    ["session_note_versions", ["body_encrypted"]],
  ];
  let checked = 0;
  let failed = 0;
  for (const [table, columns] of sealed) {
    for (const column of columns) {
      const { rows } = await client.query(
        `select "${column}" as value from "${table}" where "${column}" is not null order by random() limit 200`,
      );
      for (const { value } of rows) {
        checked++;
        try {
          decrypt(value);
        } catch {
          failed++;
        }
      }
    }
  }
  console.log(`Encrypted values opened: ${checked - failed} of ${checked}`);
  if (failed > 0) {
    problems.push(
      `${failed} encrypted values didn't open – is DATA_ENCRYPTION_KEY the production key?`,
    );
  }
} finally {
  await client.end();
}

if (problems.length > 0) {
  console.error(`\nRestore check FAILED:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("\nRestore check passed.");
