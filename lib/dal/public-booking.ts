import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, gte, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  type AppointmentStatus,
  availabilityExceptions,
  availabilityRules,
  clinicSettings,
  organization,
  patients,
  treatmentTypes,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { Locale } from "@/lib/i18n/config";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  type AvailabilityException,
  availableSlots,
  type DaySlots,
  type WeeklyHours,
} from "@/lib/scheduling/slots";
import { addDays, shortTime, todayIn } from "@/lib/scheduling/time";

/**
 * Online booking for patients, without a login. Everything here works from
 * the clinic's public slug, and nothing returned identifies other patients
 * or their appointments: only free start times.
 */

export type BookingClinic = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  autoConfirm: boolean;
  minNoticeMinutes: number;
  windowDays: number;
  intervalMinutes: number;
  treatmentTypes: {
    id: string;
    name: string;
    durationMinutes: number;
    priceAgorot: number | null;
  }[];
};

/** The clinic behind a booking page, or null if it doesn't exist or booking is off. */
export async function getBookingClinic(
  slug: string,
): Promise<BookingClinic | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const [clinic] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: clinicSettings.timezone,
      enabled: clinicSettings.bookingEnabled,
      autoConfirm: clinicSettings.bookingAutoConfirm,
      minNoticeMinutes: clinicSettings.bookingMinNoticeMinutes,
      windowDays: clinicSettings.bookingWindowDays,
      intervalMinutes: clinicSettings.bookingSlotIntervalMinutes,
    })
    .from(organization)
    .innerJoin(clinicSettings, eq(clinicSettings.clinicId, organization.id))
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!clinic?.enabled) return null;

  const types = await db
    .select({
      id: treatmentTypes.id,
      name: treatmentTypes.name,
      durationMinutes: treatmentTypes.durationMinutes,
      priceAgorot: treatmentTypes.priceAgorot,
    })
    .from(treatmentTypes)
    .where(
      and(
        eq(treatmentTypes.clinicId, clinic.id),
        eq(treatmentTypes.active, true),
        eq(treatmentTypes.bookableOnline, true),
      ),
    )
    .orderBy(asc(treatmentTypes.sortOrder), asc(treatmentTypes.name));

  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    timezone: clinic.timezone,
    autoConfirm: clinic.autoConfirm,
    minNoticeMinutes: clinic.minNoticeMinutes,
    windowDays: clinic.windowDays,
    intervalMinutes: clinic.intervalMinutes,
    treatmentTypes: types,
  };
}

/** Free start times for one bookable treatment type. */
export async function getAvailableSlots(
  clinic: BookingClinic,
  treatmentTypeId: string,
  now: Date = new Date(),
): Promise<DaySlots[]> {
  const type = clinic.treatmentTypes.find((t) => t.id === treatmentTypeId);
  if (!type) return [];

  const today = todayIn(clinic.timezone, now);
  const lastDay = addDays(today, clinic.windowDays);
  const [rules, exceptionRows, busyRows] = await Promise.all([
    db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.clinicId, clinic.id)),
    db
      .select()
      .from(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.clinicId, clinic.id),
          gte(availabilityExceptions.date, today),
          lte(availabilityExceptions.date, lastDay),
        ),
      ),
    db
      .select({ start: appointments.startsAt, end: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinic.id),
          ne(appointments.status, "cancelled"),
          gt(appointments.endsAt, now),
          lt(
            appointments.startsAt,
            new Date(now.getTime() + (clinic.windowDays + 2) * 86_400_000),
          ),
        ),
      ),
  ]);

  const weekly: WeeklyHours = [[], [], [], [], [], [], []];
  for (const rule of rules) {
    weekly[rule.weekday].push({
      start: shortTime(rule.startTime),
      end: shortTime(rule.endTime),
    });
  }
  const exceptions: AvailabilityException[] = exceptionRows.map((row) => ({
    id: row.id,
    date: row.date,
    range:
      row.startTime && row.endTime
        ? { start: shortTime(row.startTime), end: shortTime(row.endTime) }
        : null,
  }));

  return availableSlots({
    timezone: clinic.timezone,
    weekly,
    exceptions,
    busy: busyRows,
    now,
    minNoticeMinutes: clinic.minNoticeMinutes,
    windowDays: clinic.windowDays,
    intervalMinutes: clinic.intervalMinutes,
    durationMinutes: type.durationMinutes,
  });
}

export type OnlineBookingInput = {
  treatmentTypeId: string;
  startsAt: string;
  fullName: string;
  /** E.164 */
  phone: string;
  email: string;
  reminderConsent: boolean;
  locale: Locale;
};

export type BookingError = "notFound" | "slotUnavailable" | "rateLimited";

export type BookingResult =
  | {
      ok: true;
      appointmentId: string;
      cancelToken: string;
      status: AppointmentStatus;
      startsAt: string;
      treatmentName: string;
    }
  | { ok: false; error: BookingError };

/** Cancel links carry a random secret; only its hash is stored. */
function newCancelToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashCancelToken(token) };
}

export function hashCancelToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/**
 * Books a slot from the public page.
 *
 * The requested time must still be one of the offered slots, and the
 * database's no-overlap rule settles any race between two patients.
 * A returning patient is matched by phone number within the clinic; their
 * card isn't changed except to add an email address if it had none.
 */
export async function bookOnline(
  clinic: BookingClinic,
  input: OnlineBookingInput,
  { now = new Date(), clientKey }: { now?: Date; clientKey: string },
): Promise<BookingResult> {
  const type = clinic.treatmentTypes.find(
    (t) => t.id === input.treatmentTypeId,
  );
  if (!type) return { ok: false, error: "notFound" };

  // Per device/network and per phone number, to stop floods of bookings.
  const allowed =
    (await consumeRateLimit(`booking:client:${clientKey}`, 10, 3600, now)) &&
    (await consumeRateLimit(`booking:phone:${input.phone}`, 3, 86_400, now));
  if (!allowed) return { ok: false, error: "rateLimited" };

  const offered = (await getAvailableSlots(clinic, type.id, now))
    .flatMap((day) => day.slots)
    .some((slot) => slot.startsAt === input.startsAt);
  if (!offered) return { ok: false, error: "slotUnavailable" };

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + type.durationMinutes * 60_000);
  const status: AppointmentStatus = clinic.autoConfirm
    ? "confirmed"
    : "scheduled";
  const { token, hash } = newCancelToken();

  try {
    const appointmentId = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: patients.id, email: patients.email })
        .from(patients)
        .where(
          and(
            eq(patients.clinicId, clinic.id),
            eq(patients.phone, input.phone),
          ),
        )
        // Active cards before archived ones, then the oldest.
        .orderBy(
          sql`${patients.archivedAt} is not null`,
          asc(patients.createdAt),
        )
        .limit(1);

      let patientId = existing?.id;
      if (existing && !existing.email && input.email) {
        await tx
          .update(patients)
          .set({ email: input.email })
          .where(
            and(eq(patients.id, existing.id), eq(patients.clinicId, clinic.id)),
          );
      }
      if (!patientId) {
        const [created] = await tx
          .insert(patients)
          .values({
            clinicId: clinic.id,
            fullName: input.fullName,
            phone: input.phone,
            email: input.email || null,
            preferredLocale: input.locale,
            reminderConsent: input.reminderConsent,
          })
          .returning({ id: patients.id });
        patientId = created.id;
      }

      const [row] = await tx
        .insert(appointments)
        .values({
          clinicId: clinic.id,
          patientId,
          treatmentTypeId: type.id,
          startsAt,
          endsAt,
          status,
          source: "online",
          cancelTokenHash: hash,
        })
        .returning({ id: appointments.id });
      return row.id;
    });

    await recordAudit({
      clinicId: clinic.id,
      action: "appointment.booked_online",
      entity: "appointment",
      entityId: appointmentId,
    });
    return {
      ok: true,
      appointmentId,
      cancelToken: token,
      status,
      startsAt: startsAt.toISOString(),
      treatmentName: type.name,
    };
  } catch (error) {
    const code =
      (error as { code?: unknown })?.code ??
      (error as { cause?: { code?: unknown } })?.cause?.code;
    if (code === "23P01") return { ok: false, error: "slotUnavailable" };
    throw error;
  }
}

export type CancelView = {
  clinicName: string;
  clinicSlug: string;
  timezone: string;
  startsAt: string;
  treatmentName: string | null;
  status: AppointmentStatus;
  canCancel: boolean;
};

async function findByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      clinicName: organization.name,
      clinicSlug: organization.slug,
      timezone: clinicSettings.timezone,
      startsAt: appointments.startsAt,
      treatmentName: treatmentTypes.name,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(organization, eq(organization.id, appointments.clinicId))
    .innerJoin(
      clinicSettings,
      eq(clinicSettings.clinicId, appointments.clinicId),
    )
    .leftJoin(
      treatmentTypes,
      and(
        eq(treatmentTypes.id, appointments.treatmentTypeId),
        eq(treatmentTypes.clinicId, appointments.clinicId),
      ),
    )
    .where(eq(appointments.cancelTokenHash, hashCancelToken(token)))
    .limit(1);
  return row ?? null;
}

const CANCELLABLE: AppointmentStatus[] = ["scheduled", "confirmed"];

/** What the patient's cancel link shows: when and what, never who. */
export async function getAppointmentByCancelToken(
  token: string,
  now: Date = new Date(),
): Promise<CancelView | null> {
  const row = await findByToken(token);
  if (!row) return null;
  return {
    clinicName: row.clinicName,
    clinicSlug: row.clinicSlug,
    timezone: row.timezone,
    startsAt: row.startsAt.toISOString(),
    treatmentName: row.treatmentName,
    status: row.status,
    canCancel: CANCELLABLE.includes(row.status) && row.startsAt > now,
  };
}

export async function cancelByToken(
  token: string,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: "notFound" | "notCancellable" }> {
  const row = await findByToken(token);
  if (!row) return { ok: false, error: "notFound" };
  if (!CANCELLABLE.includes(row.status) || row.startsAt <= now) {
    return { ok: false, error: "notCancellable" };
  }
  await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(
      and(eq(appointments.id, row.id), eq(appointments.clinicId, row.clinicId)),
    );
  await recordAudit({
    clinicId: row.clinicId,
    action: "appointment.cancelled_by_patient",
    entity: "appointment",
    entityId: row.id,
  });
  return { ok: true };
}

/**
 * A new cancel link for an online booking (used when the practitioner
 * confirms it, so the patient's latest email has a working link).
 */
export async function rotateCancelToken(
  clinicId: string,
  appointmentId: string,
): Promise<string> {
  const { token, hash } = newCancelToken();
  await db
    .update(appointments)
    .set({ cancelTokenHash: hash })
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.clinicId, clinicId),
      ),
    );
  return token;
}
