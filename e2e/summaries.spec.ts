import { expect, test } from "@playwright/test";
import { DateTime } from "luxon";
import { format } from "../lib/i18n/format";
import { he, signUpPractitioner } from "./helpers";

const s = he.summary;
const card = he.patients.card;

test("a practitioner writes, saves and edits a session summary", async ({
  page,
}) => {
  const run = Date.now().toString(36);
  await signUpPractitioner(page, {
    name: "דנה סיכומים",
    email: `summaries-${run}@example.test`,
    password: `e2e-password-${run}`,
    clinic: "קליניקת סיכומים",
    slug: `summaries-${run}`,
  });

  // A patient with an important note, and yesterday's session.
  await page.goto("/he/patients/new");
  await page.getByLabel(he.patients.form.fullName).fill("יעל שמש");
  await page.getByLabel(he.patients.form.phone).fill("052-333-4444");
  await page
    .getByLabel(he.patients.form.importantNotes)
    .fill("רגישות לשמן לבנדר");
  await page.getByRole("button", { name: he.patients.form.save }).click();
  await expect(page.getByRole("heading", { name: "יעל שמש" })).toBeVisible();

  const yesterday = DateTime.now().setZone("Asia/Jerusalem").minus({ days: 1 });
  await page.goto("/he/calendar");
  await page.getByRole("button", { name: he.calendar.newAppointment }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(he.appointment.patientSearch).fill("יעל");
  await dialog.getByRole("button", { name: /יעל שמש/ }).click();
  await dialog.getByLabel(he.appointment.date).fill(yesterday.toISODate()!);
  await dialog.getByLabel(he.appointment.time).fill("10:00");
  await dialog.getByRole("button", { name: he.appointment.save }).click();
  await expect(dialog).toBeHidden();

  // The dashboard lists it under "summaries to write".
  await page.goto("/he/dashboard");
  const missing = page
    .getByText(he.dashboard.missingTitle)
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await missing.getByRole("link", { name: /יעל שמש/ }).click();

  // The editor shows the patient's important note.
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await expect(page.getByText("רגישות לשמן לבנדר")).toBeVisible();

  // The draft saves itself and survives a reload.
  const editor = page.getByLabel(s.label);
  await editor.fill("טיפול רפלקסולוגיה מלא. כאב בעקב שמאל.");
  await expect(page.getByRole("status")).toContainText(
    s.draftSaved.split("{")[0].trim(),
  );
  await page.reload();
  await expect(page.getByLabel(s.label)).toHaveValue(
    "טיפול רפלקסולוגיה מלא. כאב בעקב שמאל.",
  );

  // Save the summary: it becomes final with one version.
  await page.getByRole("button", { name: s.finalize }).click();
  await expect(page.getByText(s.statusFinal, { exact: true })).toBeVisible();
  await expect(page.getByText(s.versions)).toBeVisible();

  // Edit it: a second version is kept, and the first is still readable.
  await page
    .getByLabel(s.label)
    .fill("טיפול רפלקסולוגיה מלא. כאב בעקב שמאל, השתפר בסוף הטיפול.");
  await page.getByRole("button", { name: s.saveChanges }).click();
  const history = page
    .getByText(s.versions)
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await history.getByRole("button", { name: s.view }).last().click();
  await expect(history).toContainText("טיפול רפלקסולוגיה מלא. כאב בעקב שמאל.");

  // The patient card's timeline shows the latest text; the session is completed.
  await page.getByRole("link", { name: s.backToPatient }).click();
  const timeline = page
    .getByText(card.summaries, { exact: true })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(timeline).toContainText("השתפר בסוף הטיפול");
  await expect(timeline).toContainText(format(card.editedBadge, { n: "2" }));
  await expect(
    page.getByText(he.appointment.status.completed, { exact: true }).first(),
  ).toBeVisible();

  // Nothing left to write.
  await page.goto("/he/dashboard");
  await expect(page.getByText(he.dashboard.missingEmpty)).toBeVisible();
});

test("a summary can be added from the patient card, also for a session that isn't in the calendar", async ({
  page,
}) => {
  const run = Date.now().toString(36);
  await signUpPractitioner(page, {
    name: "דנה כרטיס",
    email: `card-summary-${run}@example.test`,
    password: `e2e-password-${run}`,
    clinic: "קליניקת כרטיס",
    slug: `card-summary-${run}`,
  });

  await page.goto("/he/patients/new");
  await page.getByLabel(he.patients.form.fullName).fill("אורי גל");
  await page.getByLabel(he.patients.form.phone).fill("054-555-6666");
  await page.getByRole("button", { name: he.patients.form.save }).click();
  await expect(page.getByRole("heading", { name: "אורי גל" })).toBeVisible();
  const patientUrl = page.url();

  // No appointment in the calendar: record yesterday's session from the card.
  const yesterday = DateTime.now().setZone("Asia/Jerusalem").minus({ days: 1 });
  await page.getByRole("button", { name: card.addSummary }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(card.pendingSessions)).toBeHidden();
  await dialog.getByLabel(he.appointment.date).fill(yesterday.toISODate()!);
  await dialog.getByLabel(he.appointment.time).fill("15:30");
  await dialog.getByRole("button", { name: card.continueToSummary }).click();

  // The summary page for that session; the session is already completed.
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await expect(
    page.getByText(he.appointment.status.completed, { exact: true }),
  ).toBeVisible();
  await page.getByLabel(s.label).fill("טיפול שלא נקבע ביומן. שחרור כתפיים.");
  await page.getByRole("button", { name: s.finalize }).click();
  await expect(page.getByText(s.statusFinal, { exact: true })).toBeVisible();

  // Back on the card: the summary is in the timeline.
  await page.goto(patientUrl);
  await expect(page.getByText("שחרור כתפיים")).toBeVisible();

  // A future date isn't accepted for this option.
  await page.getByRole("button", { name: card.addSummary }).click();
  const second = page.getByRole("dialog");
  const tomorrow = yesterday.plus({ days: 2 });
  const date = second.getByLabel(he.appointment.date);
  // Skip the browser's own max-date check to reach the server's.
  await date.evaluate((input) => input.removeAttribute("max"));
  await date.fill(tomorrow.toISODate()!);
  await second.getByLabel(he.appointment.time).fill("10:00");
  await second.getByRole("button", { name: card.continueToSummary }).click();
  await expect(second.getByText(he.appointment.errors.notPast)).toBeVisible();
  await page.keyboard.press("Escape");

  // A booked past session without a summary is offered in the dialog.
  await page.goto("/he/calendar");
  await page.getByRole("button", { name: he.calendar.newAppointment }).click();
  const booking = page.getByRole("dialog");
  await booking.getByPlaceholder(he.appointment.patientSearch).fill("אורי");
  await booking.getByRole("button", { name: /אורי גל/ }).click();
  await booking.getByLabel(he.appointment.date).fill(yesterday.toISODate()!);
  await booking.getByLabel(he.appointment.time).fill("09:00");
  await booking.getByRole("button", { name: he.appointment.save }).click();
  await expect(booking).toBeHidden();

  await page.goto(patientUrl);
  await page.getByRole("button", { name: card.addSummary }).click();
  const third = page.getByRole("dialog");
  await expect(third.getByText(card.pendingSessions)).toBeVisible();
  await third.getByRole("link", { name: /09:00/ }).click();
  await expect(page.getByRole("heading", { name: s.title })).toBeVisible();
  await expect(page.getByText("09:00–10:00")).toBeVisible();
});
