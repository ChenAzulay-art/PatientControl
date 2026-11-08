// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "./index";

const sendEmail = vi.fn<(message: EmailMessage) => Promise<{ id?: string }>>(
  async () => ({ id: "msg-1" }),
);
vi.mock("./index", () => ({ sendEmail }));

const { sendReminderEmail } = await import("./reminder");

const base = {
  to: "noa@example.test",
  patientName: "Noa",
  clinicName: "Dana Reflexology",
  startsAt: "2026-12-02T08:00:00.000Z",
  timezone: "Asia/Jerusalem",
};

describe("sendReminderEmail", () => {
  it("writes in the patient's language, in the clinic's time zone", async () => {
    await sendReminderEmail({
      ...base,
      locale: "en",
      treatmentName: "Reflexology",
      cancelUrl: "https://x.test/en/book/cancel?token=abc",
    });
    expect(sendEmail).toHaveBeenLastCalledWith({
      to: "noa@example.test",
      subject: "Appointment reminder – Dana Reflexology",
      text: expect.stringContaining(
        "for Reflexology on Wednesday, 2 December 2026, 10:00 at Dana Reflexology.",
      ),
    });
    expect(sendEmail.mock.lastCall?.[0].text).toContain(
      "https://x.test/en/book/cancel?token=abc",
    );
  });

  it("asks the patient to contact the clinic when there's no cancel link", async () => {
    await sendReminderEmail({
      ...base,
      locale: "he",
      treatmentName: null,
      cancelUrl: null,
    });
    const { subject, text } = sendEmail.mock.lastCall![0];
    expect(subject).toBe("תזכורת לתור – Dana Reflexology");
    expect(text).toContain("יש לך תור ביום רביעי, 2 בדצמבר 2026, 10:00");
    expect(text).toContain("נא לעדכן את הקליניקה");
    expect(text).not.toMatch(/\{\w+\}/);
  });
});
