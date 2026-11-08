import { createHmac } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import he from "../messages/he.json";
import { EMAIL_SINK_DIR } from "../playwright.config";

export { he };

type SentEmail = { to: string; subject: string; text: string };

/**
 * Waits for the newest email to `to` in the test outbox (optionally one
 * whose subject contains `subject`) and returns it.
 */
export async function waitForEmail(
  to: string,
  subject?: string,
): Promise<SentEmail> {
  let found: SentEmail | undefined;
  await expect
    .poll(
      async () => {
        const files = await readdir(EMAIL_SINK_DIR).catch(() => []);
        const emails = await Promise.all(
          files
            .sort()
            .reverse()
            .map(
              async (file) =>
                JSON.parse(
                  await readFile(path.join(EMAIL_SINK_DIR, file), "utf8"),
                ) as SentEmail,
            ),
        );
        found = emails.find(
          (email) =>
            email.to === to && (!subject || email.subject.includes(subject)),
        );
        return Boolean(found);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

export function firstLink(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("No link in email");
  return match[0];
}

/** The current 6-digit code for a base32 TOTP secret, like an authenticator app. */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = secret
    .replace(/=+$/, "")
    .toUpperCase()
    .split("")
    .map((ch) => alphabet.indexOf(ch).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/**
 * Signs up a new practitioner and takes them through email verification,
 * two-step setup and onboarding, ending on the dashboard (in Hebrew).
 */
export async function signUpPractitioner(
  page: Page,
  account: {
    name: string;
    email: string;
    password: string;
    clinic: string;
    slug: string;
  },
) {
  await page.goto("/he/signup");
  await page.getByLabel(he.auth.name).fill(account.name);
  await page.getByLabel(he.auth.email).fill(account.email);
  await page.getByLabel(he.auth.password).fill(account.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: he.auth.signup.submit }).click();
  await expect(page).toHaveURL(/\/he\/verify-email$/);

  const email = await waitForEmail(account.email);
  await page.goto(firstLink(email.text));
  await expect(page).toHaveURL(/\/he\/setup-2fa$/);

  await page
    .getByLabel(he.auth.setup2fa.confirmPassword)
    .fill(account.password);
  await page.getByRole("button", { name: he.auth.setup2fa.start }).click();
  const secret = (await page.locator("code").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);

  await page.locator('input[autocomplete="one-time-code"]').fill(totp(secret));
  await page.getByRole("button", { name: he.auth.setup2fa.verify }).click();
  await page.getByRole("button", { name: he.auth.setup2fa.continue }).click();

  await expect(page).toHaveURL(/\/he\/onboarding$/);
  await page.getByLabel(he.onboarding.clinicName).fill(account.clinic);
  await page.getByLabel(he.onboarding.slug).fill(account.slug);
  await page.getByRole("button", { name: he.onboarding.submit }).click();
  await expect(page).toHaveURL(/\/he\/dashboard$/);

  return { secret };
}

/** Adds a treatment type in Settings and waits for it to appear in the list. */
export async function addTreatmentType(
  page: Page,
  type: {
    name: string;
    durationMinutes?: number;
    price?: string;
    bookableOnline?: boolean;
  },
) {
  await page.goto("/he/settings");
  // The add form is the last form in the section (each list row has its own small form).
  const form = page.locator("#treatment-types form").last();
  await form.getByLabel(he.treatmentTypes.name).fill(type.name);
  if (type.durationMinutes) {
    await form
      .getByLabel(he.treatmentTypes.duration)
      .fill(String(type.durationMinutes));
  }
  if (type.price) {
    await form.getByLabel(he.treatmentTypes.price).fill(type.price);
  }
  if (type.bookableOnline) {
    await form.getByLabel(he.treatmentTypes.bookableOnline).check();
  }
  await form.getByRole("button", { name: he.treatmentTypes.add }).click();
  await expect(
    page.locator("#treatment-types li", { hasText: type.name }),
  ).toBeVisible();
}
