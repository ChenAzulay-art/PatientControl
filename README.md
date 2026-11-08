# Patient Control

Clinic management for independent practitioners (reflexologists, physiotherapists and others): patient cards, scheduling and a treatment summary after every session. Hebrew (right-to-left, default) and English.

Built with Next.js 16 (App Router, Cache Components), Better Auth, Drizzle ORM on Postgres (Neon in production), Tailwind CSS and shadcn/ui.

## Local development

```bash
npm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET and DATA_ENCRYPTION_KEY (each: openssl rand -base64 32)
npm run db:migrate:local        # create the tables in the local database
npm run dev:local               # start the app with the local database
```

`dev:local` runs a local Postgres-compatible database (PGlite, stored in `.data/pglite`), so you don't need Neon or Docker. Emails (verification, password reset) are printed to the terminal instead of being sent while `RESEND_API_KEY` is empty.

Every account must turn on two-step verification with an authenticator app before reaching the clinic.

## With Neon and Resend (Vercel)

1. Import the repository into Vercel.
2. From the Vercel Marketplace, add **Neon** (Postgres) and **Resend** to the project.
3. In the project's environment variables, set `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `BETTER_AUTH_URL` (the site's URL) and `EMAIL_FROM` (a sender on your verified Resend domain). Keep a safe copy of `DATA_ENCRYPTION_KEY`: without it, encrypted patient fields can't be read.
4. Locally: `vercel env pull .env.local`, then `npm run db:migrate` and `npm run dev`.

## Scripts

| Script                                            | What it does                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `npm run dev:local`               | Start the app against `DATABASE_URL` / the local database                                                         |
| `npm run db:generate`                             | Create a migration in `drizzle/` from changes in `db/schema/`                                                     |
| `npm run db:migrate` / `npm run db:migrate:local` | Apply migrations to `DATABASE_URL` / the local database                                                           |
| `npm run check`                                   | Type-check, lint, format check and tests (the same as CI)                                                         |
| `npm test` / `npm run test:watch`                 | Run tests once / on every change                                                                                  |
| `npm run test:e2e`                                | End-to-end tests in a browser, against a fresh in-memory database (first time: `npx playwright install chromium`) |

## Where things live

- `app/[locale]/` – pages; `(auth)` for sign-up, login and onboarding, `(app)` for the signed-in clinic
- `lib/dal/` – the only way pages and actions reach clinic data; checks the session, two-step verification and clinic membership, scopes every query to the clinic and records patient views and changes in the audit log
- `lib/scheduling/` – time-zone conversions (clinic wall-clock time ↔ stored instants, including daylight-saving changes) and calendar colors; overlapping appointments are blocked by a database constraint in `drizzle/0002_scheduling.sql`
- `lib/dal/session-notes.ts` – treatment summaries: drafts save automatically, saving makes them final, and every later change is kept as a version
- `lib/dal/public-booking.ts` and `app/[locale]/book/` – online booking without a login: free times from `lib/scheduling/slots.ts`, booking, and the cancel link; protected by Vercel BotID (`instrumentation-client.ts`) and rate limits (`lib/rate-limit.ts`)
- `lib/crypto.ts` – encryption of the ID number, medical background and important notes
- `e2e/` – Playwright end-to-end tests
- `lib/auth.ts` – Better Auth configuration (email verification, two-step verification, rate limits, clinics as organizations)
- `db/schema/` – database tables; `drizzle/` – migrations
- `messages/` – Hebrew and English text
