import { defineConfig } from "drizzle-kit";

// `db:generate` works without a database. `db:migrate` needs DATABASE_URL:
// use `npm run db:migrate:local` for the local database, or put Neon's URL in .env.local.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
