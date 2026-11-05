import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 10;

/** Booking-page address: 3–40 lowercase letters, digits and inner dashes. */
export const clinicSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/)
  .refine((slug) => !slug.includes("--"));

export const clinicNameSchema = z.string().trim().min(2).max(80);

export const createClinicSchema = z.object({
  name: clinicNameSchema,
  slug: clinicSlugSchema,
});

/** A 6-digit authenticator code, ignoring spaces people type or paste. */
export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/));
