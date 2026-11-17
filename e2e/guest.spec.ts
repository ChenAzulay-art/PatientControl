import { expect, test } from "@playwright/test";
import en from "../messages/en.json";

test("a guest explores a demo clinic, and exiting deletes everything", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  const g = en.guest;

  // No sign-up, no two-step verification: straight to the dashboard.
  await page.goto("/en");
  await page.getByRole("button", { name: g.try }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.getByText(g.banner)).toBeVisible();

  // The demo clinic comes with patients and a summary history.
  await page.goto("/en/patients");
  await expect(page.getByText("Noa Levi")).toBeVisible();
  await page.getByRole("link", { name: /Noa Levi/ }).click();
  await expect(page.getByRole("heading", { name: "Noa Levi" })).toBeVisible();
  await expect(page.getByText(/Recommended: 10 minutes/)).toBeVisible();

  // Guests can add their own patients.
  await page.goto("/en/patients/new");
  const form = en.patients.form;
  await page.getByLabel(form.fullName).fill("Interviewer Test");
  await page.getByLabel(form.phone).fill("052-555-0101");
  await page.getByRole("button", { name: form.save }).click();
  await expect(
    page.getByRole("heading", { name: "Interviewer Test" }),
  ).toBeVisible();

  // Settings: no account deletion for guests (exiting does that).
  await page.goto("/en/settings");
  await expect(page.locator("#delete-account")).toHaveCount(0);

  // Exiting guest mode deletes the clinic.
  await page.getByRole("button", { name: g.exit }).click();
  await expect(page).toHaveURL(/\/en\?guest=ended$/);
  await expect(page.getByText(g.ended)).toBeVisible();
  await page.goto("/en/dashboard");
  await expect(page).toHaveURL(/\/en\/login$/);

  // A new guest session starts fresh: the demo data, without the earlier patient.
  await page.getByRole("button", { name: g.try }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await page.goto("/en/patients");
  await expect(page.getByText("Noa Levi")).toBeVisible();
  await expect(page.getByText("Interviewer Test")).toHaveCount(0);
});
