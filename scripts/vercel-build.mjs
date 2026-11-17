// Vercel's build command (`npm run vercel-build`, which Vercel prefers over
// `build` when it exists).
//
// On production deployments it first applies the migrations in drizzle/ to
// the Neon database, so new tables appear with the code that needs them.
// Migrations only add or change what the app needs; they never drop patient
// data. Preview deployments share the same database, so they skip this step:
// a branch that isn't merged must never change the production schema.
//
// If a migration fails, or the tables still aren't there afterwards, the
// build stops and Vercel keeps serving the previous deployment.
//
//   node scripts/vercel-build.mjs                 migrate (production only), then next build
//   node scripts/vercel-build.mjs --migrate-only  for testing: skip next build
import { spawnSync } from "node:child_process";
import pg from "pg";

const production = process.env.VERCEL_ENV === "production";
const migrateOnly = process.argv.includes("--migrate-only");

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) {
    console.error(
      `\n✗ ${command} ${args.join(" ")} failed (exit ${result.status}).`,
    );
    process.exit(result.status ?? 1);
  }
}

if (production) {
  // Neon's direct connection is better for schema changes than the pooled one.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "✗ DATABASE_URL is not set, so the database can't be migrated.",
    );
    process.exit(1);
  }

  console.log("Applying database migrations…");
  run("npx", ["drizzle-kit", "migrate"], { ...process.env, DATABASE_URL: url });

  // drizzle-kit has been known to exit quietly without applying anything, so
  // check that the app's tables really exist before going live.
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select to_regclass('public.organization') is not null as ok, (select count(*)::int from drizzle.__drizzle_migrations) as applied",
    );
    if (!rows[0].ok) {
      console.error("✗ The migrations ran, but the app's tables are missing.");
      process.exit(1);
    }
    console.log(
      `✓ Database is up to date (${rows[0].applied} migrations applied).`,
    );
  } finally {
    await client.end();
  }
} else {
  console.log(
    `Skipping database migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}; they run on production deployments only).`,
  );
}

if (!migrateOnly) run("npx", ["next", "build"]);
