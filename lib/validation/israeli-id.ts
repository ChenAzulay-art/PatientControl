/**
 * Israeli ID number (מספר תעודת זהות): up to 9 digits, where the last is a
 * check digit. Shorter numbers are padded with leading zeros.
 */

/** Digits only, padded to 9. Returns null if it can't be an ID number. */
export function normalizeIsraeliId(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  if (!/^\d{5,9}$/.test(digits)) return null;
  return digits.padStart(9, "0");
}

/** True if the (normalized) number passes the check-digit test. */
export function isValidIsraeliId(input: string): boolean {
  const id = normalizeIsraeliId(input);
  if (!id || id === "000000000") return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let step = Number(id[i]) * ((i % 2) + 1);
    if (step > 9) step -= 9;
    sum += step;
  }
  return sum % 10 === 0;
}
