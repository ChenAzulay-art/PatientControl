# Plan: "Try it as a guest"

Status: **built** on branch `guest-mode`, with the recommended answer to each of the three decisions at the end.

## Goal

Let prospective interviewers who find the project on GitHub explore the live
app without signing up: add patients, book appointments in the calendar, write
session summaries, and so on. When they sign out, nothing they did is kept.

## The approach

Clicking **"Try it as a guest"** creates a **private, temporary clinic** just
for that visitor, filled with demo data. They can use every feature with no
sign-up and no two-step verification. **Signing out deletes the clinic and
everything in it.** Clinics of guests who just close the tab are deleted
automatically after a few hours.

### Alternatives considered

- **One shared demo account:** rejected. Interviewers would see each other's
  changes, the data would pile up, and the account's password and two-step
  code would have to be published.
- **Keeping everything in the browser:** rejected. All the app's data code
  runs on the server against Postgres, so this would mean a rewrite. A real
  throwaway clinic exercises the real code, which is also more impressive to
  show.

## How it works

### 1. Signing in as a guest

- Better Auth, the sign-in library the app uses, has a built-in
  **`anonymous`** plugin (`node_modules/better-auth/dist/plugins/anonymous`).
  It creates a user and a session with no email or password, and marks the
  user with an `isAnonymous` flag.
- A new action, `startGuestSession`:
  1. Signs in anonymously.
  2. Creates a clinic with a random address (e.g. `demo-k3f9x2`).
  3. Seeds it with demo data.
  4. Sends the visitor to the dashboard.
- **Guests skip two-step verification.** Only `requireSecureUser`
  (`lib/dal/session.ts`) changes, and only for anonymous users. Guests can
  only ever reach their own sandbox clinic.

### 2. Demo data

So the app doesn't open empty:

- **Basics:** 3 treatment types and working hours (Sunday–Thursday).
- **Patients:** 6 fictional patients in Hebrew or English, matching the chosen
  language. ID numbers pass the check-digit test but belong to no one.
- **Appointments:**
  - About 10 this week.
  - A few past ones with finished summaries, one with an edit history, so the
    timeline shows versions.
  - One online booking waiting for approval.

### 3. Signing out deletes everything

- When a guest signs out, the action deletes their clinic and user, reusing
  `deleteClinicAccount` (`lib/dal/account.ts`), then signs out.
- Their audit-log rows are deleted too, so nothing is left behind.

### 4. Automatic cleanup of abandoned guests

- **Lifetime:** guest sessions expire after **2 hours**.
- **Cleanup job:** a new schedule in `vercel.json`, `/api/cron/cleanup-guests`,
  runs **every hour** with the same `CRON_SECRET` protection as the reminders
  job. It deletes guest clinics older than 3 hours, and never touches real
  accounts.
- **Vercel limits:** the hourly job adds about 720 runs a month. Together with
  reminders (every 15 minutes) that's about 3,600 of the 5,000 runs the free
  plan allows.

### 5. Guests never send real emails

This is the most important safety rule. A guest might type a real person's
email into a patient card.

- **Reminders:** the reminders job (`lib/reminders/run.ts`) skips guest clinics.
- **Booking emails:** confirmations, approvals and cancellations from a guest
  clinic aren't sent (`lib/email/booking.ts`,
  `lib/notifications/appointment-status.ts`,
  `app/[locale]/book/[slug]/actions.ts`).
- **Enforcement:** the rule is applied once, in the email layer, with a test
  that proves no email leaves a guest clinic.

### 6. Abuse protection

The site is public, and Neon's free plan is limited.

- **Rate limits:** at most **5 guest sessions per hour per IP address**, using
  the existing rate limiter (`lib/rate-limit.ts`), plus a **daily cap of about
  200** guest sessions in total.
- **Bot check:** Vercel BotID protects the "Try as guest" button, like the
  booking form (`instrumentation-client.ts`).
- **Size limit:** up to 100 patients and 300 appointments per guest clinic.

### 7. Interface

- **Entry points:** a **"Try it as a guest"** button on the home page and the
  login page.
- **Banner:** a permanent banner inside the app: _"Guest mode: please don't
  enter real patient details. Everything is deleted when you sign out."_
- **Sign-out:** the button becomes **"Exit guest mode"**, with a short
  confirmation that the data will be deleted.
- **Settings:** "Delete account" is hidden for guests (signing out already does
  it). Data export stays, so they can see it.
- **Translations:** Hebrew and English (`messages/he.json`, `messages/en.json`).

### 8. For interviewers

- **README:** a "Live demo" section at the top with the link and one line:
  "Click _Try it as a guest_, no sign-up needed."
- **Legal pages:** one sentence in the privacy policy saying guest data is
  temporary and deleted within hours.

## Database change

- One migration: Better Auth's `is_anonymous` column on `user`, and an index
  for the cleanup job.
- No changes to existing tables beyond that. The guest flag lives on the user,
  and the clinic is found through its owner.

## Tests

- **Unit tests:**
  - A guest gets their own seeded clinic, and two guests can't see each other.
  - Signing out deletes everything.
  - The cleanup job deletes only old guest clinics, never real ones.
  - No email is sent for a guest clinic.
  - Guests skip two-step verification, and real users still can't.
  - The rate limits work.
- **End-to-end test:**
  1. Click "Try as guest" and see the dashboard with demo data.
  2. Add a patient, book an appointment and write a summary.
  3. Exit guest mode, start a new guest session, and confirm the earlier
     patient is gone.

## Delivery

- Branch `guest-mode`, then `npm run check`, the end-to-end tests and the
  production build, then a push and a pull request into `chore/vitest-setup`.
- After the merge, migrations apply automatically on deploy
  (`scripts/vercel-build.mjs`). Then test guest mode on the live site.

## Open decisions (recommendation first)

1. **Starting data:**
   - **Pre-filled demo clinic (recommended).** Interviewers see a lived-in app
     in seconds.
   - Or an empty clinic.
2. **Guest lifetime:**
   - **2-hour session, deleted within about an hour after that
     (recommended).**
   - Or longer, e.g. 24 hours, if interviewers might come back later the same
     day.
3. **Public booking page for guests:**
   - **Keep it (recommended).** It works at the guest's own `demo-…` address,
     with no emails sent.
   - Or turn it off for guests.
