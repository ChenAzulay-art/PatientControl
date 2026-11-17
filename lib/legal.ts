/**
 * Details shown in the privacy policy and terms of use.
 *
 * Fill these in before launch, and set `reviewed` to true only after an
 * Israeli privacy lawyer has approved the texts (see docs/legal-review.md).
 * Until then every legal page shows a "draft" notice.
 */
export const LEGAL = {
  reviewed: false,
  lastUpdated: "2026-11-17",
  operator: {
    he: "[שם העסק המפעיל ומספר עוסק/ח״פ]",
    en: "[Operating business name and registration number]",
  },
  contactEmail: "privacy@[your-domain]",
  /** How long deleted data can remain in database backups (Neon restore window). */
  backupRetentionDays: 7,
  /**
   * Where the app's servers (Vercel functions) and the Neon database run.
   * Both are in Washington, D.C. (Vercel region iad1, Neon us-east). Keep this
   * in step with the actual settings; a Neon database's region can't change.
   */
  hostingRegion: {
    he: "ארצות הברית (וושינגטון די.סי.)",
    en: "the United States (Washington, D.C.)",
  },
} as const;
