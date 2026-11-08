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

/** Weekday names, index 0 = Sunday, in the reader's language. */
export function weekdayNames(locale: Locale): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale[locale], {
    weekday: "long",
    timeZone: "UTC",
  });
  // 1 January 2023 was a Sunday.
  return Array.from({ length: 7 }, (_, day) =>
    formatter.format(new Date(Date.UTC(2023, 0, 1 + day))),
  );
}

/** Time of day of an instant in the clinic's time zone, e.g. 09:30. */
export function formatTime(
  locale: Locale,
  value: Date,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(value);
}

/** e.g. "Sun, 9 Nov" / "יום א׳, 9 בנוב׳" for an instant in the clinic's time zone. */
export function formatDayShort(
  locale: Locale,
  value: Date,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(value);
}
