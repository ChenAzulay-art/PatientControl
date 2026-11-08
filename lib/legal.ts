/**
 * Details shown in the privacy policy and terms of use.
 *
 * Fill these in before launch, and set `reviewed` to true only after an
 * Israeli privacy lawyer has approved the texts (see docs/legal-review.md).
 * Until then every legal page shows a "draft" notice.
 */
export const LEGAL = {
  reviewed: false,
  lastUpdated: "2026-11-08",
  operator: {
    he: "[שם העסק המפעיל ומספר עוסק/ח״פ]",
    en: "[Operating business name and registration number]",
  },
  contactEmail: "privacy@[your-domain]",
  /** How long deleted data can remain in database backups (Neon restore window). */
  backupRetentionDays: 7,
  hostingRegion: {
    he: "האיחוד האירופי (פרנקפורט, גרמניה)",
    en: "the European Union (Frankfurt, Germany)",
  },
} as const;
