import { z } from "zod";
import { locales } from "@/lib/i18n/config";
import { isValidIsraeliId, normalizeIsraeliId } from "./israeli-id";
import { normalizePhone } from "./phone";

/** Error codes map to `patients.errors.*` messages. */
export type PatientFieldError =
  | "nameRequired"
  | "phoneInvalid"
  | "emailInvalid"
  | "dateOfBirthInvalid"
  | "nationalIdInvalid"
  | "tooLong";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: "tooLong" })
    .transform((value) => (value === "" ? null : value));

export const patientInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "nameRequired" })
    .max(120, { message: "tooLong" }),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value, ctx) => {
      if (value === "") return null;
      if (!z.email().safeParse(value).success || value.length > 254) {
        ctx.addIssue({ code: "custom", message: "emailInvalid" });
        return z.NEVER;
      }
      return value;
    }),
  dateOfBirth: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const valid =
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value &&
        value >= "1900-01-01" &&
        value <= new Date().toISOString().slice(0, 10);
      if (!valid) {
        ctx.addIssue({ code: "custom", message: "dateOfBirthInvalid" });
        return z.NEVER;
      }
      return value;
    }),
  nationalId: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const id = normalizeIsraeliId(value);
      if (!id || !isValidIsraeliId(id)) {
        ctx.addIssue({ code: "custom", message: "nationalIdInvalid" });
        return z.NEVER;
      }
      return id;
    }),
  medicalBackground: optionalText(5000),
  importantNotes: optionalText(2000),
  treatmentTypeIds: z.array(z.uuid()).max(50).default([]),
  preferredLocale: z.enum(locales),
  reminderConsent: z.boolean(),
});

export type PatientInput = z.infer<typeof patientInputSchema>;

/** Reads the patient form's fields from FormData into the schema's input shape. */
export function patientFormValues(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
    dateOfBirth: text("dateOfBirth"),
    nationalId: text("nationalId"),
    medicalBackground: text("medicalBackground"),
    importantNotes: text("importantNotes"),
    treatmentTypeIds: formData.getAll("treatmentTypeIds").map(String),
    preferredLocale: text("preferredLocale"),
    reminderConsent: formData.get("reminderConsent") === "on",
  };
}

export type PatientFormValues = ReturnType<typeof patientFormValues>;

export const treatmentTypeNameSchema = z.string().trim().min(2).max(60);
