import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { he, signUpPractitioner, waitForEmail } from "./helpers";

/** Fails the test if the Content Security Policy blocks anything on the page. */
function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}

async function addPatient(page: Page, name: string) {
  await page.goto("/he/patients/new");
  const form = he.patients.form;
  await page.getByLabel(form.fullName).fill(name);
  await page.getByLabel(form.phone).fill("052-123-4567");
  await page.getByLabel(form.medicalBackground).fill("Knee surgery in 2019");
  await page.getByRole("button", { name: form.save }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("legal pages, CSP, data export and account deletion", async ({ page }) => {
  const violations = watchCsp(page);
  const run = Date.now().toString(36);
  const slug = `launch-${run}`;
  const email = `${slug}@example.test`;
  const password = `e2e-password-${run}`;

  // Legal pages are public, linked from every page, and marked as drafts.
  const home = await page.goto("/he");
  expect(home?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: he.legal.privacy })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: he.legal.privacy }),
  ).toBeVisible();
  await expect(page.getByText(he.legal.draft)).toBeVisible();
  await page.goto("/en/terms");
  await expect(
    page.getByRole("heading", { level: 1, name: "Terms of use" }),
  ).toBeVisible();

  await signUpPractitioner(page, {
    name: "דנה השקה",
    email,
    password,
    clinic: "Launch Clinic",
    slug,
  });
  await addPatient(page, "Noa Export");

  // One patient's file, from their card.
  const [patientFile] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: he.dataExport.downloadPatient }).click(),
  ]);
  const patientData = JSON.parse(
    await readFile((await patientFile.path())!, "utf8"),
  );
  expect(patientData.scope).toBe("patient");
  expect(patientData.patients[0]).toMatchObject({
    fullName: "Noa Export",
    medicalBackground: "Knee surgery in 2019",
  });

  // The whole clinic needs the password again.
  await page.goto("/he/settings");
  const exportCard = page.locator("#export");
  await exportCard.getByLabel(he.dataExport.password).fill("wrong-password-1");
  await exportCard
    .getByRole("button", { name: he.dataExport.downloadClinic })
    .click();
  await expect(exportCard.getByText(he.dataExport.wrongPassword)).toBeVisible();

  await exportCard.getByLabel(he.dataExport.password).fill(password);
  const [clinicFile] = await Promise.all([
    page.waitForEvent("download"),
    exportCard
      .getByRole("button", { name: he.dataExport.downloadClinic })
      .click(),
  ]);
  expect(clinicFile.suggestedFilename()).toMatch(
    new RegExp(`^clinic-${slug}-\\d{4}-\\d{2}-\\d{2}\\.json$`),
  );
  const clinicData = JSON.parse(
    await readFile((await clinicFile.path())!, "utf8"),
  );
  expect(clinicData).toMatchObject({ scope: "clinic", clinic: { slug } });
  expect(clinicData.patients).toHaveLength(1);

  // Deleting needs the clinic's address and the password.
  const d = he.deleteAccount;
  const danger = page.locator("#delete-account");
  await danger.getByLabel(d.password).fill(password);
  await danger.getByRole("textbox").first().fill("not-the-slug");
  await danger.getByRole("button", { name: d.submit }).click();
  await expect(danger.getByText(d.errors.confirm)).toBeVisible();

  await danger.getByRole("textbox").first().fill(slug);
  await danger.getByLabel(d.password).fill(password);
  await danger.getByRole("button", { name: d.submit }).click();
  await expect(page).toHaveURL(/\/he\/account-deleted$/);
  await expect(page.getByRole("heading", { name: d.done.title })).toBeVisible();
  await waitForEmail(email, "נמחק");

  // Signed out, and the account no longer exists.
  await page.goto("/he/dashboard");
  await expect(page).toHaveURL(/\/he\/login$/);
  await page.getByLabel(he.auth.email).fill(email);
  await page.getByLabel(he.auth.password).fill(password);
  await page.getByRole("button", { name: he.auth.login.submit }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/he\/login$/);

  expect(violations).toEqual([]);
});
