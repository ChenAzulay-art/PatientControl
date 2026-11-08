import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { format } from "../lib/i18n/format";
import { addTreatmentType, he, signUpPractitioner } from "./helpers";

const a = he.appointment;

test("a practitioner sets hours and books, moves to completed, and sees appointments", async ({
  page,
}) => {
  const run = Date.now().toString(36);
  await signUpPractitioner(page, {
    name: "דנה יומן",
    email: `calendar-${run}@example.test`,
    password: `e2e-password-${run}`,
    clinic: "קליניקת יומן",
    slug: `calendar-${run}`,
  });

  // Settings: a 45-minute treatment type with a price, and Sunday hours.
  await page.goto("/he/settings");
  await addTreatmentType(page, {
    name: "רפלקסולוגיה",
    durationMinutes: 45,
    price: "250",
  });
  await expect(
    page.locator("#treatment-types li", { hasText: "רפלקסולוגיה" }),
  ).toContainText(format(a.minutes, { n: "45" }));

  const hours = page.locator("#working-hours");
  await hours
    .getByRole("button", { name: new RegExp(he.workingHours.addRange) })
    .first()
    .click();
  await hours.getByRole("button", { name: he.workingHours.save }).click();
  await expect(hours.getByText(he.workingHours.saved)).toBeVisible();

  // A patient to book.
  await page.goto("/he/patients/new");
  await page.getByLabel(he.patients.form.fullName).fill("נועה ברק");
  await page.getByLabel(he.patients.form.phone).fill("050-111-2222");
  await page.getByRole("button", { name: he.patients.form.save }).click();
  await expect(page.getByRole("heading", { name: "נועה ברק" })).toBeVisible();

  // Book from the calendar for tomorrow at 10:00.
  const tomorrow = DateTime.now().setZone("Asia/Jerusalem").plus({ days: 1 });
  await page.goto("/he/calendar");
  const book = async () => {
    await page
      .getByRole("button", { name: he.calendar.newAppointment })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder(a.patientSearch).fill("נועה");
    await dialog.getByRole("button", { name: /נועה ברק/ }).click();
    await dialog
      .getByLabel(a.treatmentType)
      .selectOption({ label: "רפלקסולוגיה" });
    await expect(dialog.getByLabel(a.duration)).toHaveValue("45");
    await dialog.getByLabel(a.date).fill(tomorrow.toISODate()!);
    await dialog.getByLabel(a.time).fill("10:00");
    await dialog.getByRole("button", { name: a.save }).click();
    return dialog;
  };

  await book();
  await expect(page.getByRole("dialog")).toBeHidden();

  // The same time again is refused.
  const second = await book();
  await expect(second.getByText(a.errors.overlap)).toBeVisible();
  await page.keyboard.press("Escape");

  // The week view shows tomorrow unless today is Saturday (a new week starts on Sunday).
  if (tomorrow.weekday !== 7) {
    const event = page.locator(".fc-event", { hasText: "נועה ברק" });
    await expect(event).toBeVisible();
    await event.click();
    const details = page.getByRole("dialog");
    await expect(details).toContainText(a.status.scheduled);
    await details.getByRole("button", { name: a.actions.complete }).click();
    await expect(details).toBeHidden();
  }

  // The patient card lists the appointment.
  await page.goto("/he/patients");
  await page.getByRole("link", { name: /נועה ברק/ }).click();
  const appointments = page.getByText(he.patients.card.upcoming).locator("..");
  await expect(appointments).toContainText("רפלקסולוגיה");
  await expect(appointments).toContainText("10:00");
  if (tomorrow.weekday !== 7) {
    await expect(appointments).toContainText(a.status.completed);
  }
});
