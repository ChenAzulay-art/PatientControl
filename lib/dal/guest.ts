import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  auditLog,
  clinicSettings,
  member,
  organization,
  user,
} from "@/db/schema";
import { demoContent, demoNationalId, demoPhone } from "@/lib/guest/demo-data";
import type { Locale } from "@/lib/i18n/config";
import { addDays, todayIn } from "@/lib/scheduling/time";
import { createAppointment, setAppointmentStatus } from "./appointments";
import { setWorkingHours } from "./availability";
import type { ClinicContext } from "./context";
import { createPatient } from "./patients";
import { saveFinalSessionNote } from "./session-notes";
import { createTreatmentType } from "./treatment-types";

/**
 * "Try it as a guest": every guest gets a private demo clinic, deleted when
 * they sign out or by the cleanup job (app/api/cron/cleanup-guests). Guest
 * clinics never send emails (lib/email/demo-guard.ts, lib/reminders/run.ts).
 */

/** The cleanup job deletes guests older than this (sessions end at 2 hours). */
export const GUEST_MAX_AGE_MINUTES = 180;

/**
 * Creates the guest's demo clinic and fills it with fictional patients,
 * appointments and summaries. `userId` must be a new anonymous user.
 */
export async function createGuestClinic(
  userId: string,
  locale: Locale,
  now: Date = new Date(),
): Promise<ClinicContext> {
  const content = demoContent(locale);
  const clinicId = randomUUID();
  const slug = `demo-${randomBytes(4).toString("hex")}`;

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({
      id: clinicId,
      name: content.clinicName,
      slug,
      createdAt: now,
    });
    await tx.insert(member).values({
      id: randomUUID(),
      organizationId: clinicId,
      userId,
      role: "owner",
      createdAt: now,
    });
    await tx.insert(clinicSettings).values({
      clinicId,
      defaultLocale: locale,
      isDemo: true,
      // Show the whole flow: the booking page is open and requests need approval.
      bookingEnabled: true,
      bookingAutoConfirm: false,
    });
  });

  const ctx: ClinicContext = {
    user: {
      id: userId,
      name: "Guest",
      email: "",
      twoFactorEnabled: false,
      isGuest: true,
    },
    clinic: {
      id: clinicId,
      name: content.clinicName,
      slug,
      role: "owner",
      timezone: "Asia/Jerusalem",
      isDemo: true,
    },
  };
  await seedDemoClinic(ctx, locale, now);
  return ctx;
}

async function seedDemoClinic(ctx: ClinicContext, locale: Locale, now: Date) {
  const content = demoContent(locale);

  const treatmentIds = new Map<string, string>();
  for (const treatment of content.treatments) {
    const { key, ...input } = treatment;
    const result = await createTreatmentType(ctx, input);
    if (result.ok) treatmentIds.set(key, result.id);
  }

  // Sunday–Thursday 09:00–18:00.
  const day = [{ start: "09:00", end: "18:00" }];
  await setWorkingHours(ctx, [day, day, day, day, day, [], []]);

  const patientIds = new Map<string, string>();
  for (const [index, patient] of content.patients.entries()) {
    const id = await createPatient(ctx, {
      fullName: patient.fullName,
      phone: demoPhone(index),
      email: `${patient.key}@example.test`,
      dateOfBirth: `${1975 + index * 4}-0${(index % 9) + 1}-15`,
      nationalId: demoNationalId(index),
      medicalBackground: patient.medicalBackground,
      importantNotes: patient.importantNotes,
      treatmentTypeIds: patient.treatments
        .map((key) => treatmentIds.get(key))
        .filter((id): id is string => Boolean(id)),
      preferredLocale: patient.preferredLocale,
      reminderConsent: true,
    });
    patientIds.set(patient.key, id);
  }

  const today = todayIn(ctx.clinic.timezone, now);
  for (const appointment of content.appointments) {
    const patientId = patientIds.get(appointment.patient);
    const treatment = content.treatments.find(
      (t) => t.key === appointment.treatment,
    );
    if (!patientId || !treatment) continue;
    const past = appointment.dayOffset < 0;
    const result = await createAppointment(
      ctx,
      {
        patientId,
        treatmentTypeId: treatmentIds.get(treatment.key) ?? null,
        date: addDays(today, appointment.dayOffset),
        time: appointment.time,
        durationMinutes: treatment.durationMinutes,
      },
      { pastSession: past, now },
    );
    if (!result.ok) continue;

    for (const text of appointment.summaries ?? []) {
      await saveFinalSessionNote(ctx, result.id, text);
    }
    if (past) await setAppointmentStatus(ctx, result.id, "completed");
    if (appointment.onlineRequest) {
      await db
        .update(appointments)
        .set({ source: "online" })
        .where(
          and(
            eq(appointments.id, result.id),
            eq(appointments.clinicId, ctx.clinic.id),
          ),
        );
    }
  }
}

/**
 * Deletes a guest: their demo clinic with everything in it, their audit
 * entries, and the guest user. Does nothing to real (non-guest) users or
 * clinics that aren't demo clinics.
 */
export async function deleteGuestData(userId: string): Promise<boolean> {
  const [guest] = await db
    .select({ isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!guest?.isAnonymous) return false;

  const clinics = await db
    .select({ id: member.organizationId })
    .from(member)
    .innerJoin(
      clinicSettings,
      eq(clinicSettings.clinicId, member.organizationId),
    )
    .where(and(eq(member.userId, userId), eq(clinicSettings.isDemo, true)));
  const clinicIds = clinics.map((clinic) => clinic.id);

  await db.transaction(async (tx) => {
    await tx
      .delete(auditLog)
      .where(
        clinicIds.length > 0
          ? or(
              eq(auditLog.actorId, userId),
              inArray(auditLog.clinicId, clinicIds),
            )
          : eq(auditLog.actorId, userId),
      );
    if (clinicIds.length > 0) {
      // Every clinic table cascades from the organization.
      await tx.delete(organization).where(inArray(organization.id, clinicIds));
    }
    // Sessions cascade from the user.
    await tx
      .delete(user)
      .where(and(eq(user.id, userId), eq(user.isAnonymous, true)));
  });
  return true;
}

/**
 * Deletes guests whose time is up, and any demo clinic left without its
 * guest. Run hourly by app/api/cron/cleanup-guests.
 */
export async function cleanupGuests(
  now: Date = new Date(),
): Promise<{ guests: number; clinics: number }> {
  const cutoff = new Date(now.getTime() - GUEST_MAX_AGE_MINUTES * 60_000);

  const oldGuests = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.isAnonymous, true), lt(user.createdAt, cutoff)))
    .limit(500);
  for (const guest of oldGuests) await deleteGuestData(guest.id);

  // Demo clinics whose guest is already gone (e.g. a failed sign-in).
  const orphans = await db
    .select({ id: organization.id })
    .from(organization)
    .innerJoin(clinicSettings, eq(clinicSettings.clinicId, organization.id))
    .where(
      and(eq(clinicSettings.isDemo, true), lt(organization.createdAt, cutoff)),
    );
  const orphanIds = [...new Set(orphans.map((row) => row.id))];
  const stillOwned = orphanIds.length
    ? await db
        .select({ id: member.organizationId })
        .from(member)
        .where(inArray(member.organizationId, orphanIds))
    : [];
  const owned = new Set(stillOwned.map((row) => row.id));
  const toDelete = orphanIds.filter((id) => !owned.has(id));
  if (toDelete.length > 0) {
    await db.delete(auditLog).where(inArray(auditLog.clinicId, toDelete));
    await db.delete(organization).where(inArray(organization.id, toDelete));
  }

  return { guests: oldGuests.length, clinics: toDelete.length };
}
