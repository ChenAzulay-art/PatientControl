import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { Client } from "pg";
import { CRON_SECRET, LOCAL_DB_PORT } from "../playwright.config";
import { he, signUpPractitioner, waitForEmail } from "./helpers";

const r = he.reminders;

/** Moves a clinic's appointments' booking time back, as if booked days ago. */
async function bookedDaysAgo(slug: string) {
  const client = new Client({
    connectionString: `postgres://postgres:postgres@127.0.0.1:${LOCAL_DB_PORT}/postgres`,
  });
  await client.connect();
  try {
    await client.query(
      `update appointments set created_at = now() - interval '3 days'
       where clinic_id = (select id from organization where slug = $1)`,
      [slug],
    );
  } finally {
    await client.end();
  }
}

test("reminders go to patients who agreed, in their language, and show in Settings", async ({
  page,
  request,
}) => {
  const run = Date.now().toString(36);
  const slug = `reminders-${run}`;
  const patientEmail = `noa-${run}@example.test`;
  await signUpPractitioner(page, {
    name: "דנה תזכורות",
    email: `${slug}@example.test`,
    password: `e2e-password-${run}`,
    clinic: "Reminder Clinic",
    slug,
  });

  // Send reminders 6 hours ahead.
  await page.goto("/he/settings");
  const settings = page.locator("#reminders");
  await expect(settings.getByLabel(r.enabled)).toBeChecked();
  await expect(settings.getByText(r.none)).toBeVisible();
  await settings.getByLabel(r.lead).selectOption("360");
  await settings.getByRole("button", { name: r.save }).click();
  await expect(settings.getByText(r.saved)).toBeVisible();

  // A patient who agreed to reminders and reads English.
  await page.goto("/he/patients/new");
  const form = he.patients.form;
  await page.getByLabel(form.fullName).fill("Noa Reminder");
  await page.getByLabel(form.phone).fill("052-777-8888");
  await page.getByLabel(form.email).fill(patientEmail);
  await page.getByLabel(form.preferredLocale).selectOption("en");
  await page.getByLabel(form.reminderConsent).check();
  await page.getByRole("button", { name: form.save }).click();
  await expect(
    page.getByRole("heading", { name: "Noa Reminder" }),
  ).toBeVisible();

  // An appointment about three hours from now.
  const start = DateTime.now()
    .setZone("Asia/Jerusalem")
    .plus({ hours: 3 })
    .startOf("hour");
  await page.goto("/he/calendar");
  await page.getByRole("button", { name: he.calendar.newAppointment }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(he.appointment.patientSearch).fill("Noa");
  await dialog.getByRole("button", { name: /Noa Reminder/ }).click();
  await dialog.getByLabel(he.appointment.date).fill(start.toISODate()!);
  await dialog.getByLabel(he.appointment.time).fill(start.toFormat("HH:mm"));
  await dialog.getByRole("button", { name: he.appointment.save }).click();
  await expect(dialog).toBeHidden();
  // Appointments booked inside the reminder window get none, so backdate it.
  await bookedDaysAgo(slug);

  // The job refuses callers without the secret.
  expect((await request.post("/api/cron/reminders")).status()).toBe(401);

  const response = await request.post("/api/cron/reminders", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).sent).toBeGreaterThanOrEqual(1);

  const email = await waitForEmail(patientEmail, "Appointment reminder");
  expect(email.subject).toBe("Appointment reminder – Reminder Clinic");
  expect(email.text).toContain("Hello Noa Reminder");
  expect(email.text).toContain(start.toFormat("HH:mm"));
  expect(email.text).toContain("please let the clinic know");

  // A second run doesn't send it again.
  const again = await request.post("/api/cron/reminders", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect((await again.json()).failed).toBe(0);

  // The log in Settings.
  await page.goto("/he/settings");
  const entry = settings.getByRole("listitem").filter({
    hasText: "Noa Reminder",
  });
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(r.status.sent);
});
