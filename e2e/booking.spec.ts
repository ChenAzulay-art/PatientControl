import { expect, test, type Page } from "@playwright/test";
import { format } from "../lib/i18n/format";
import {
  addTreatmentType,
  firstLink,
  he,
  signUpPractitioner,
  waitForEmail,
} from "./helpers";

const b = he.booking;
const ob = he.onlineBooking;

/** As a patient (no login): book the first free time. */
async function bookAsPatient(
  page: Page,
  slug: string,
  name: string,
  email: string,
  phone: string,
) {
  await page.goto(`/he/book/${slug}`);
  // One bookable treatment: its times are shown straight away.
  await page.locator('button[role="radio"][dir="ltr"]').first().click();
  await page.getByLabel(b.fullName).fill(name);
  await page.getByLabel(b.phone).fill(phone);
  await page.getByLabel(b.email).fill(email);
  await page.getByRole("button", { name: b.submit }).click();
}

test("patients book online, cancel by link, and requests can be approved", async ({
  page,
  browser,
}) => {
  const run = Date.now().toString(36);
  const slug = `booking-${run}`;
  await signUpPractitioner(page, {
    name: "דנה אונליין",
    email: `booking-${run}@example.test`,
    password: `e2e-password-${run}`,
    clinic: "קליניקת אונליין",
    slug,
  });

  // Practitioner: a bookable treatment, hours every day, booking on with no minimum notice.
  await addTreatmentType(page, {
    name: "רפלקסולוגיה",
    durationMinutes: 60,
    bookableOnline: true,
  });
  const hours = page.locator("#working-hours");
  const addButtons = hours.getByRole("button", {
    name: new RegExp(he.workingHours.addRange),
  });
  for (let day = 0; day < 7; day++) await addButtons.nth(day).click();
  await hours.getByRole("button", { name: he.workingHours.save }).click();
  await expect(hours.getByText(he.workingHours.saved)).toBeVisible();

  const settings = page.locator("#online-booking");
  await settings.getByLabel(ob.enabled).check();
  await settings.getByLabel(ob.minNotice).selectOption("0");
  await settings.getByRole("button", { name: ob.save }).click();
  await expect(settings.getByText(ob.saved)).toBeVisible();
  await expect(settings.locator("code")).toContainText(`/he/book/${slug}`);

  // Patient, in a separate browser without the practitioner's login.
  const patientContext = await browser.newContext();
  const patient = await patientContext.newPage();
  const first = `patient-${run}@example.test`;
  await bookAsPatient(patient, slug, "מיכל לקוחה", first, "053-777-8888");
  await expect(
    patient.getByRole("heading", { name: b.confirmedTitle }),
  ).toBeVisible();

  // The confirmation email has a cancel link that works once.
  const confirmation = await waitForEmail(first);
  expect(confirmation.subject).toContain("קליניקת אונליין");
  await patient.goto(firstLink(confirmation.text));
  await expect(patient.getByText("רפלקסולוגיה ב")).toBeVisible();
  await patient.getByRole("button", { name: b.cancel.confirm }).click();
  await expect(patient.getByText(b.cancel.cancelled)).toBeVisible();
  await patient.reload();
  await expect(patient.getByText(b.cancel.alreadyCancelled)).toBeVisible();

  // Practitioner: approval required.
  await page.goto("/he/settings");
  await page.locator("#online-booking").getByLabel(ob.autoConfirm).uncheck();
  await page
    .locator("#online-booking")
    .getByRole("button", { name: ob.save })
    .click();
  await expect(
    page.locator("#online-booking").getByText(ob.saved),
  ).toBeVisible();

  const second = `patient2-${run}@example.test`;
  // A different phone number: the same number would be matched to the first patient's card.
  await bookAsPatient(patient, slug, "רון מבקש", second, "053-777-9999");
  await expect(
    patient.getByRole("heading", { name: b.requestedTitle }),
  ).toBeVisible();
  await waitForEmail(second, "קיבלנו");

  // The request waits on the dashboard; confirming it emails the patient.
  await page.goto("/he/dashboard");
  const requests = page
    .getByText(he.dashboard.requestsTitle)
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(requests).toContainText("רון מבקש");
  await requests
    .getByRole("button", {
      name: format("{label}: {name}", {
        label: he.dashboard.approve,
        name: "רון מבקש",
      }),
    })
    .click();
  await expect(page.getByText(he.dashboard.requestsTitle)).toBeHidden();
  const approved = await waitForEmail(second, "אושר");
  expect(approved.text).toContain("/he/book/cancel?token=");

  await patientContext.close();
});

test("an unknown or closed booking page shows a not-found page", async ({
  page,
}) => {
  await page.goto("/he/book/no-such-clinic-anywhere");
  await expect(
    page.getByRole("heading", { name: he.common.notFoundTitle }),
  ).toBeVisible();
});
