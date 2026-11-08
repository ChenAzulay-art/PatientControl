// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runReminders = vi.fn(async () => ({ sent: 2, retrying: 0, failed: 0 }));
vi.mock("@/lib/reminders/run", () => ({ runReminders }));
vi.mock("@/lib/site-url", () => ({
  siteUrl: async () => "https://clinic.example.test",
}));

const { POST } = await import("./route");

const call = (authorization?: string) =>
  POST(
    new Request("https://clinic.example.test/api/cron/reminders", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );

afterEach(() => {
  vi.unstubAllEnvs();
  runReminders.mockClear();
});

describe("POST /api/cron/reminders", () => {
  it("runs the reminders with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", "a-long-test-secret-value");
    const response = await call("Bearer a-long-test-secret-value");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 2, retrying: 0, failed: 0 });
    expect(runReminders).toHaveBeenCalledWith({
      origin: "https://clinic.example.test",
    });
  });

  it("refuses a missing or wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "a-long-test-secret-value");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("a-long-test-secret-value")).status).toBe(401);
    expect(runReminders).not.toHaveBeenCalled();
  });

  it("refuses everyone when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(runReminders).not.toHaveBeenCalled();
  });
});
