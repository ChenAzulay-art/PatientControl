# Backups and restoring

Patient records are medical records, so losing them is as serious as leaking
them. This page covers what is backed up, what you must keep yourself, and how
to prove a restore works.

## What protects the data

| Layer                                            | What it covers                                                                   | Who keeps it        |
| ------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------- |
| **Neon point-in-time restore**                   | The whole database, to any moment inside the restore window                      | Neon, automatically |
| **`DATA_ENCRYPTION_KEY`**                        | Needed to read ID numbers, medical background, notes and summaries in _any_ copy | **You** – see below |
| **Clinic exports** (Settings → Export your data) | One clinic's records as JSON                                                     | The practitioner    |

### The restore window

Neon keeps the history needed to restore to any earlier moment, but only for a
limited window that depends on the plan. Check it in the Neon console under the
project's settings. The free plan's window is short; before taking real
patients, move to a paid plan and set the window to at least 7 days. Keep
`backupRetentionDays` in `lib/legal.ts` equal to it, because the privacy
policy promises that deleted data leaves backups within that many days.

### The encryption key is the backup of the backup

The sensitive fields are encrypted in the app before they reach the database.
A restored database **without the same `DATA_ENCRYPTION_KEY` is unreadable.**

- Keep a copy of the production key outside Vercel, in a password manager
  that you (and one trusted person) can open even if the Vercel account is lost.
- Never change the key in Vercel without a key-rotation plan: existing data
  stays encrypted with the old key.

## Restore test (do it before launch, then every 3 months)

1. **Create a restored copy.** In the Neon console, open the project →
   **Branches** → **Create branch**, choose the production branch as the
   parent and pick a point in time (for example one hour ago). This makes a
   separate copy; production isn't touched. (`neonctl branches create --help`
   shows the same from the command line.)
2. **Copy its connection string** from the branch's **Connect** dialog.
3. **Run the check** on your computer, with the production
   `DATA_ENCRYPTION_KEY` in `.env.local` (`vercel env pull` fetches it):

   ```bash
   npm run db:verify-restore -- "postgres://…the restored branch…"
   ```

   It checks that every migration is there, prints how many clinics,
   patients, appointments and summaries the copy has and how recent it is,
   and opens a sample of the encrypted values with the key. It prints counts
   only, never patient details, and ends with **Restore check passed** or
   explains what failed.

4. **Compare** the counts and the newest audit entry with what you expect for
   the chosen moment.
5. **Delete the branch** in the Neon console. It holds a full copy of patient
   data and shouldn't be left around.
6. **Write down** the date and the result (for example in a `RESTORES.md`
   kept outside this repository, or in your security log). The Israeli Data
   Security Regulations expect you to be able to show backups are tested.

## Restoring for real

If production data is damaged or deleted by mistake:

1. Note the time just before the problem.
2. In the Neon console, use **Restore** on the production branch to that
   time (Neon keeps the replaced state as a backup branch, so this can be
   undone), or create a branch from that time and copy back only what's
   needed.
3. Run `npm run db:verify-restore` against it.
4. If you restored the whole branch, nothing else changes: the app keeps the
   same connection string.
5. Record what happened and when. If patient data was exposed or lost, check
   with your lawyer whether the breach must be reported to the Privacy
   Protection Authority.
