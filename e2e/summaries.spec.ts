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
