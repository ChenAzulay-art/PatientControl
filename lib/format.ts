import type { Locale } from "@/lib/i18n/config";

/** Each language's name in its own language, for language pickers. */
export const languageNames: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

const intlLocale: Record<Locale, string> = { he: "he-IL", en: "en-IL" };

/** A calendar date (YYYY-MM-DD) shown in the reader's language, e.g. 14.3.1985 / 14 Mar 1985. */
export function formatDate(locale: Locale, isoDate: string): string {
  // Midday UTC, so the date never shifts across a time-zone boundary.
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatDateTime(
  locale: Locale,
  value: Date,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

/** Whole years between a birth date (YYYY-MM-DD) and `today`. */
export function ageOn(isoBirthDate: string, today: Date = new Date()): number {
  const [year, month, day] = isoBirthDate.split("-").map(Number);
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}
