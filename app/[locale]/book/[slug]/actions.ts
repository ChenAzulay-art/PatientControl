"use server";

import { checkBotId } from "botid/server";
import { headers } from "next/headers";
import { z } from "zod";
import { sendBookingEmail } from "@/lib/email/booking";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import {
  bookOnline,
  type BookingError,
  getAvailableSlots,
  getBookingClinic,
} from "@/lib/dal/public-booking";
import type { DaySlots } from "@/lib/scheduling/slots";
import { siteUrl } from "@/lib/site-url";
import { normalizePhone } from "@/lib/validation/phone";

/** Free times for the chosen treatment. Public: no login. */
export async function getSlotsAction(input: {
  slug: string;
  treatmentTypeId: string;
}): Promise<DaySlots[]> {
  const clinic = await getBookingClinic(String(input.slug));
  if (!clinic) return [];
  return getAvailableSlots(clinic, String(input.treatmentTypeId));
}

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "nameRequired").max(120, "nameRequired"),
  phone: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return phone;
  }),
  email: z.string().trim().toLowerCase().pipe(z.email("emailInvalid").max(254)),
});

type FieldError = "nameRequired" | "phoneInvalid" | "emailInvalid";

export type BookActionResult =
  | { ok: true; status: "confirmed" | "scheduled"; email: string }
  | {
      ok: false;
      error?: BookingError | "bot" | "generic";
      fieldErrors?: Partial<Record<"fullName" | "phone" | "email", FieldError>>;
    };

/** The client's address for rate limiting (the first hop Vercel reports). */
async function clientKey(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function bookAction(input: {
  slug: string;
  locale: string;
  treatmentTypeId: string;
  startsAt: string;
  fullName: string;
  phone: string;
  email: string;
  reminderConsent: boolean;
}): Promise<BookActionResult> {
  // Vercel BotID: blocks automated submissions (always passes in development).
  const verification = await checkBotId();
  if (verification.isBot) return { ok: false, error: "bot" };

  const locale = isLocale(input.locale) ? input.locale : defaultLocale;
  const parsed = detailsSchema.safeParse({
    fullName: String(input.fullName ?? ""),
    phone: String(input.phone ?? ""),
    email: String(input.email ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Extract<BookActionResult, { ok: false }>["fieldErrors"] =
      {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as "fullName" | "phone" | "email";
      fieldErrors[field] ??= issue.message as FieldError;
    }
    return { ok: false, fieldErrors };
  }

  const clinic = await getBookingClinic(String(input.slug));
  if (!clinic) return { ok: false, error: "notFound" };

  const result = await bookOnline(
    clinic,
    {
      treatmentTypeId: String(input.treatmentTypeId),
      startsAt: String(input.startsAt),
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      reminderConsent: input.reminderConsent === true,
      locale,
    },
    { clientKey: await clientKey() },
  );
  if (!result.ok) return { ok: false, error: result.error };

  const origin = await siteUrl();
  try {
    await sendBookingEmail({
      kind: result.status === "confirmed" ? "confirmed" : "requested",
      to: parsed.data.email,
      locale,
      patientName: parsed.data.fullName,
      clinicName: clinic.name,
      treatmentName: result.treatmentName,
      startsAt: result.startsAt,
      timezone: clinic.timezone,
      cancelUrl: `${origin}/${locale}/book/cancel?token=${result.cancelToken}`,
    });
  } catch {
    // The booking stands even if the email fails; the clinic sees it either way.
    console.error("[booking] confirmation email failed");
  }

  return {
    ok: true,
    status: result.status === "confirmed" ? "confirmed" : "scheduled",
    email: parsed.data.email,
  };
}
