// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { redactAddresses, sendEmail } = await import("./index");

afterEach(() => {
  vi.unstubAllEnvs();
  send.mockReset();
});

describe("sendEmail", () => {
  it("reports the provider's reason, without email addresses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("EMAIL_FROM", "Clinic <clinic@example.test>");
    send.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        message:
          "You can only send testing emails to your own email address (owner@example.test).",
      },
    });

    const failure = sendEmail({
      to: "noa@example.test",
      subject: "Hi",
      text: "Hello",
    });
    await expect(failure).rejects.toThrow(
      "Email failed to send: validation_error: You can only send testing emails to your own email address ([address]).",
    );
    await expect(failure).rejects.not.toThrow(/@/);
  });
});

describe("redactAddresses", () => {
  it("replaces addresses, including ones in angle brackets", () => {
    expect(
      redactAddresses(
        "Invalid `from` field: Patient Control <x@resend.dev>, to noa@example.test.",
      ),
    ).toBe("Invalid `from` field: Patient Control <[address]>, to [address].");
  });
});
