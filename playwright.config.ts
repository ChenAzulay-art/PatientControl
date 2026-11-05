import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const EMAIL_SINK_DIR = ".data/e2e-emails";

/**
 * End-to-end tests run the real app against a fresh in-memory database,
 * with emails written to EMAIL_SINK_DIR instead of being sent.
 * Run with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node scripts/local-db.mjs next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/he`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      LOCAL_DB_DIR: "memory://",
      LOCAL_DB_MIGRATE: "1",
      LOCAL_DB_PORT: "5434",
      NEXT_DIST_DIR: ".next-e2e",
      EMAIL_SINK_DIR,
      // Test-only secrets for a throwaway database; never used anywhere else.
      BETTER_AUTH_SECRET: "e2e-only-secret-not-for-real-use-0123456789",
      DATA_ENCRYPTION_KEY: "ZTJlLW9ubHkta2V5LW5vdC1mb3ItcmVhbC11c2UhISE=",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
