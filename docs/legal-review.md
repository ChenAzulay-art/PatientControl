# Before taking real patients: legal review

The privacy policy (`/privacy`) and terms of use (`/terms`) are **drafts**
written by the developer, not by a lawyer. Every legal page shows a "draft"
notice until `reviewed` is set to `true` in `lib/legal.ts`.

Before launch, an Israeli lawyer who specializes in privacy should review the
texts and the questions below against the Privacy Protection Law, 1981
(including Amendment 13) and the Privacy Protection (Data Security)
Regulations, 2017.

## Fill in first

In `lib/legal.ts`:

- `operator` – the legal name and registration number of the business
  running the service.
- `contactEmail` – a real address that someone reads.
- `backupRetentionDays` – the actual Neon restore window (see `docs/backups.md`).
- `hostingRegion` – confirm the Vercel function region and the Neon region
  really are Frankfurt (Vercel project → Settings → Functions; Neon project
  settings).

## Questions for the lawyer

### Roles and contracts

1. The clinic is described as the database owner and we as a "holder"
   (מחזיק) processing on its behalf. Is that right, and do we need a separate
   data processing agreement with each clinic, or are the terms enough?
2. Is accepting the terms with a checkbox at sign-up sufficient?

### Registration and obligations

3. Does the service, or each clinic, need to register a database or appoint
   a privacy protection officer under the law as amended?
4. Which security level of the Data Security Regulations applies (health data
   is "especially sensitive"), and what documents follow from it: a database
   definition document, a security procedure, access-permission records, a
   periodic risk survey, incident logging?

### Patients

5. The booking page says the details go only to the clinic, links to the
   privacy policy, and asks for reminder consent. Does it meet the notice
   duty of section 11 (purpose, whether providing the data is required, who
   receives it)?
6. Is opt-in consent for email reminders needed, and is the current
   checkbox (checked by default on the booking page) acceptable?
7. Who answers a patient's request to see or correct their information, and
   in how many days?

### Records and deletion

8. Practitioners can delete their account and all records at once. Given the
   Patients' Rights Law and the duty to keep medical records for years (does
   it apply to complementary therapists as well as licensed professions such
   as physiotherapy?), should deletion be delayed, blocked, or allowed only
   after an export, and what should the warning say?
9. Is keeping deleted data in backups for up to N days acceptable, and must
   the policy say so (it currently does)?

### Transfers abroad and sub-processors

10. Data is stored in the EU (Frankfurt). Emails are sent through Resend,
    which may process them in the United States; emails contain the patient's
    name, the clinic and the appointment time but no medical details. Do the
    Privacy Protection (Transfer of Data to Databases Abroad) Regulations
    allow this, and what has to be in place?
11. Should the policy list sub-processors by name (it does: Vercel, Neon,
    Resend) and promise notice before adding new ones?

### Incidents

12. What must we do, and how fast, after a security incident: report to the
    Privacy Protection Authority, tell the clinics, tell patients?

### Terms

13. Is the liability clause enforceable, and should the service be limited
    to licensed or registered practitioners?
14. Is Tel Aviv–Jaffa the right exclusive jurisdiction?

## After the review

- Update the texts in `app/[locale]/(legal)/privacy/content.tsx` and
  `terms/content.tsx` (Hebrew and English must say the same thing).
- Set `lastUpdated` and `reviewed: true` in `lib/legal.ts`.
- Turn any answers that need product changes (for example delayed deletion
  or a data processing agreement) into tasks.
