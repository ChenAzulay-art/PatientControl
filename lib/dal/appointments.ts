import "server-only";
import { and, asc, desc, eq, gt, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  type AppointmentStatus,
  patients,
  treatmentTypes,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { zonedToUtc } from "@/lib/scheduling/time";
import type { AppointmentInput } from "@/lib/validation/scheduling";
import { type ClinicContext, isUuid } from "./context";
import { ownTreatmentTypeIds } from "./treatment-types";

/** What the calendar, dashboard and patient card show for an appointment. */
export type AppointmentView = {
  id: string;
  patientId: string;
  patientName: string;
  treatmentTypeId: string | null;
  treatmentName: string | null;
  color: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
};

export type AppointmentError =
  "overlap" | "notPast" | "patientNotFound" | "notFound" | "rangeTooLong";

type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: AppointmentError };

/** Postgres exclusion-constraint violation: the time overlaps another appointment. */
function isOverlap(error: unknown): boolean {
  const code =
    (error as { code?: unknown })?.code ??
    (error as { cause?: { code?: unknown } })?.cause?.code;
  return code === "23P01";
}

const MAX_RANGE_DAYS = 62;

const view = {
  id: appointments.id,
  patientId: appointments.patientId,
  patientName: patients.fullName,
  treatmentTypeId: appointments.treatmentTypeId,
  treatmentName: treatmentTypes.name,
  color: treatmentTypes.color,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  status: appointments.status,
};

type ViewRow = {
  [K in keyof typeof view]: K extends "startsAt" | "endsAt"
    ? Date
    : AppointmentView[K];
};

function toView(row: ViewRow): AppointmentView {
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  };
}

function baseQuery() {
  return db
    .select(view)
    .from(appointments)
    .innerJoin(
      patients,
      and(
        eq(patients.id, appointments.patientId),
        eq(patients.clinicId, appointments.clinicId),
      ),
    )
    .leftJoin(
      treatmentTypes,
      and(
        eq(treatmentTypes.id, appointments.treatmentTypeId),
        eq(treatmentTypes.clinicId, appointments.clinicId),
      ),
    );
}

/** Appointments that overlap [from, to), cancelled ones left out unless asked for. */
export async function listAppointments(
  ctx: ClinicContext,
  {
    from,
    to,
    includeCancelled = false,
  }: { from: Date; to: Date; includeCancelled?: boolean },
): Promise<AppointmentView[]> {
  if (!(to > from)) return [];
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) return [];
  const conditions = [
    eq(appointments.clinicId, ctx.clinic.id),
    lt(appointments.startsAt, to),
    gt(appointments.endsAt, from),
  ];
  if (!includeCancelled) conditions.push(ne(appointments.status, "cancelled"));
  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(asc(appointments.startsAt));
  return rows.map(toView);
}

/** A patient's upcoming and past appointments for their card. */
export async function listPatientAppointments(
  ctx: ClinicContext,
  patientId: string,
  now: Date = new Date(),
): Promise<{ upcoming: AppointmentView[]; past: AppointmentView[] }> {
  if (!isUuid(patientId)) return { upcoming: [], past: [] };
  const scope = and(
    eq(appointments.clinicId, ctx.clinic.id),
    eq(appointments.patientId, patientId),
  );
  const [upcoming, past] = await Promise.all([
    baseQuery()
      .where(and(scope, gte(appointments.endsAt, now)))
      .orderBy(asc(appointments.startsAt))
      .limit(20),
    baseQuery()
      .where(and(scope, lt(appointments.endsAt, now)))
      .orderBy(desc(appointments.startsAt))
      .limit(50),
  ]);
  return { upcoming: upcoming.map(toView), past: past.map(toView) };
}

export async function getAppointment(
  ctx: ClinicContext,
  id: string,
): Promise<AppointmentView | null> {
  if (!isUuid(id)) return null;
  const [row] = await baseQuery()
    .where(
      and(eq(appointments.id, id), eq(appointments.clinicId, ctx.clinic.id)),
    )
    .limit(1);
  return row ? toView(row) : null;
}

async function patientInClinic(ctx: ClinicContext, patientId: string) {
  if (!isUuid(patientId)) return false;
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(eq(patients.id, patientId), eq(patients.clinicId, ctx.clinic.id)),
    )
    .limit(1);
  return Boolean(row);
}

async function audit(ctx: ClinicContext, action: string, id: string) {
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action,
    entity: "appointment",
    entityId: id,
  });
}

/**
 * Books an appointment at a wall-clock time in the clinic's time zone.
 *
 * With `pastSession`, records a session that already happened but was never
 * booked (so a summary can be written for it): it must have started before
 * `now`, and it's saved as completed.
 */
export async function createAppointment(
  ctx: ClinicContext,
  input: AppointmentInput,
  {
    pastSession = false,
    now = new Date(),
  }: { pastSession?: boolean; now?: Date } = {},
): Promise<Result<{ id: string }>> {
  if (!(await patientInClinic(ctx, input.patientId))) {
    return { ok: false, error: "patientNotFound" };
  }
  const [treatmentTypeId = null] = input.treatmentTypeId
    ? await ownTreatmentTypeIds(ctx, [input.treatmentTypeId])
    : [];
  const startsAt = zonedToUtc(input.date, input.time, ctx.clinic.timezone);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  if (pastSession && startsAt >= now) return { ok: false, error: "notPast" };

  try {
    const [row] = await db
      .insert(appointments)
      .values({
        clinicId: ctx.clinic.id,
        patientId: input.patientId,
        treatmentTypeId,
        startsAt,
        endsAt,
        status: pastSession ? "completed" : "scheduled",
        createdBy: ctx.user.id,
      })
      .returning({ id: appointments.id });
    await audit(
      ctx,
      pastSession ? "appointment.recorded_past" : "appointment.created",
      row.id,
    );
    return { ok: true, id: row.id };
  } catch (error) {
    if (isOverlap(error)) return { ok: false, error: "overlap" };
    throw error;
  }
}

/** Changes the time, treatment type or length of an appointment. */
export async function rescheduleAppointment(
  ctx: ClinicContext,
  id: string,
  input: AppointmentInput,
): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "notFound" };
  const [treatmentTypeId = null] = input.treatmentTypeId
    ? await ownTreatmentTypeIds(ctx, [input.treatmentTypeId])
    : [];
  const startsAt = zonedToUtc(input.date, input.time, ctx.clinic.timezone);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  return updateTimes(ctx, id, { startsAt, endsAt, treatmentTypeId });
}

/** Moves an appointment to new absolute times (from dragging on the calendar). */
export async function moveAppointment(
  ctx: ClinicContext,
  id: string,
  startsAt: Date,
  endsAt: Date,
): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "notFound" };
  return updateTimes(ctx, id, { startsAt, endsAt });
}

async function updateTimes(
  ctx: ClinicContext,
  id: string,
  values: { startsAt: Date; endsAt: Date; treatmentTypeId?: string | null },
): Promise<Result> {
  try {
    const rows = await db
      .update(appointments)
      .set(values)
      .where(
        and(eq(appointments.id, id), eq(appointments.clinicId, ctx.clinic.id)),
      )
      .returning({ id: appointments.id });
    if (rows.length === 0) return { ok: false, error: "notFound" };
  } catch (error) {
    if (isOverlap(error)) return { ok: false, error: "overlap" };
    throw error;
  }
  await audit(ctx, "appointment.rescheduled", id);
  return { ok: true };
}

/**
 * Confirms, completes, cancels or marks a no-show. Restoring a cancelled
 * appointment can fail if its time has been taken since.
 */
export async function setAppointmentStatus(
  ctx: ClinicContext,
  id: string,
  status: AppointmentStatus,
): Promise<Result> {
  if (!isUuid(id)) return { ok: false, error: "notFound" };
  try {
    const rows = await db
      .update(appointments)
      .set({ status })
      .where(
        and(eq(appointments.id, id), eq(appointments.clinicId, ctx.clinic.id)),
      )
      .returning({ id: appointments.id });
    if (rows.length === 0) return { ok: false, error: "notFound" };
  } catch (error) {
    if (isOverlap(error)) return { ok: false, error: "overlap" };
    throw error;
  }
  await audit(ctx, `appointment.${status}`, id);
  return { ok: true };
}
