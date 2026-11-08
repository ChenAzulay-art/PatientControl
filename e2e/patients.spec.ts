import { expect, test } from "@playwright/test";
import { format } from "../lib/i18n/format";
import { addTreatmentType, he, signUpPractitioner } from "./helpers";

const p = he.patients;

test("a practitioner manages patient cards from sign-up to archive", async ({
  page,
}) => {
  const run = Date.now().toString(36);
  await signUpPractitioner(page, {
    name: "דנה בדיקה",
    email: `practitioner-${run}@example.test`,
    password: `e2e-password-${run}`,
    clinic: "רפלקסולוגיה דנה",
    slug: `dana-${run}`,
  });
  await expect(
    page.getByRole("heading", {
      name: format(he.dashboard.greeting, { name: "דנה בדיקה" }),
    }),
  ).toBeVisible();

  // Add a treatment type in Settings.
  await addTreatmentType(page, { name: "רפלקסולוגיה" });

  // New patient: an invalid ID number is caught before saving.
  await page.goto("/he/patients");
  await expect(page.getByText(p.empty)).toBeVisible();
  await page.getByRole("link", { name: p.new }).click();
  await page.getByLabel(p.form.fullName).fill("שרה לוי");
  await page.getByLabel(p.form.phone).fill("052-765-4321");
  await page.getByLabel(new RegExp(p.form.nationalId)).fill("123456789");
  await page.getByLabel("רפלקסולוגיה").check();
  await page.getByLabel(p.form.importantNotes).fill("רגישות לשמן לבנדר");
  await page.getByLabel(p.form.medicalBackground).fill("ניתוח ברך ב-2019");
  await page.getByRole("button", { name: p.form.save }).click();
  await expect(page.getByText(p.errors.nationalIdInvalid)).toBeVisible();

  // Values survive the failed save; fix the ID and save.
  await expect(page.getByLabel(p.form.fullName)).toHaveValue("שרה לוי");
  await page.getByLabel(new RegExp(p.form.nationalId)).fill("123456782");
  await page.getByRole("button", { name: p.form.save }).click();

  // The patient card.
  await expect(page).toHaveURL(/\/he\/patients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "שרה לוי" })).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: p.card.importantNotes }),
  ).toContainText("רגישות לשמן לבנדר");
  await expect(page.getByText("052-765-4321")).toBeVisible();
  await expect(page.getByText("123456782")).toBeVisible();
  await expect(page.getByText("ניתוח ברך ב-2019")).toBeVisible();

  // A second card with the same ID number gets a duplicate warning first.
  await page.goto("/he/patients/new");
  await page.getByLabel(p.form.fullName).fill("שרה לוי-כהן");
  await page.getByLabel(p.form.phone).fill("+972 54 111 2233");
  await page.getByLabel(new RegExp(p.form.nationalId)).fill("123456782");
  await page.getByRole("button", { name: p.form.save }).click();
  await expect(page.getByText(p.form.duplicateTitle)).toBeVisible();
  await page.getByLabel(p.form.duplicateConfirm).check();
  await page.getByRole("button", { name: p.form.save }).click();
  await expect(
    page.getByRole("heading", { name: "שרה לוי-כהן" }),
  ).toBeVisible();

  // Search by phone and by name, without the search text in the URL.
  await page.goto("/he/patients");
  const search = page.getByLabel(p.searchLabel);
  await search.fill("052-765");
  await expect(page.getByRole("link", { name: /שרה לוי(?!-)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /שרה לוי-כהן/ })).toBeHidden();
  await search.fill("כהן");
  await expect(page.getByRole("link", { name: /שרה לוי-כהן/ })).toBeVisible();
  expect(page.url()).not.toContain("כהן");

  // Archive: gone from the list, still in the archive.
  await page.getByRole("link", { name: /שרה לוי-כהן/ }).click();
  await page.getByRole("button", { name: p.card.archive }).click();
  await expect(page.getByText(p.card.archivedNotice)).toBeVisible();
  await page.goto("/he/patients");
  await expect(page.getByRole("link", { name: /שרה לוי-כהן/ })).toBeHidden();
  await page.getByRole("link", { name: p.showArchived }).click();
  await expect(page.getByRole("link", { name: /שרה לוי-כהן/ })).toBeVisible();
});

test("patient pages require login", async ({ page }) => {
  await page.goto("/he/patients");
  await expect(page).toHaveURL(/\/he\/login$/);
  await page.goto("/en/patients/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/en\/login$/);
});
