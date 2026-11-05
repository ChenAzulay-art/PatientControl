/**
 * Phone numbers are stored in E.164 (+972501234567) so search, reminders and
 * duplicate checks all see one format. Israeli local numbers are the common
 * case; other countries are accepted in international form (+...).
 */

/** Returns the number in E.164, or null if it doesn't look like a phone number. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  if (!hasPlus && digits.startsWith("00")) {
    digits = digits.slice(2);
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (hasPlus) {
    if (digits.startsWith("9720")) digits = `972${digits.slice(4)}`;
    if (digits.startsWith("972")) return israeliOrNull(digits.slice(3));
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  // Local Israeli format: 050-1234567, 03-1234567, 1-800-...
  if (digits.startsWith("0")) return israeliOrNull(digits.slice(1));
  if (digits.startsWith("972")) return israeliOrNull(digits.slice(3));
  return null;
}

/** National significant number (without the leading 0) → E.164, if plausible. */
function israeliOrNull(nsn: string): string | null {
  // Mobiles: 5X + 7 digits. Landlines: 2,3,4,8,9 + 7 digits. VoIP/other: 7X + 7 digits.
  if (/^(5\d|7\d)\d{7}$/.test(nsn) || /^[234689]\d{7}$/.test(nsn)) {
    return `+972${nsn}`;
  }
  return null;
}

/** Display form: Israeli numbers in local format (050-123-4567), others as stored. */
export function formatPhone(e164: string): string {
  if (!e164.startsWith("+972")) return e164;
  const local = `0${e164.slice(4)}`;
  if (local.length === 10) {
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  }
  return local;
}

/** Digits a search query should match against, in both local and international form. */
export function phoneSearchDigits(query: string): string | null {
  const digits = query.replace(/[^\d]/g, "");
  if (digits.length < 3) return null;
  // Typing "050..." should match "+97250...".
  return digits.startsWith("0") ? digits.slice(1) : digits;
}
