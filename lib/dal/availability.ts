import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { availabilityExceptions, availabilityRules } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { AvailabilityException } from "@/lib/scheduling/slots";
import { shortTime } from "@/lib/scheduling/time";
import type { WorkingHours } from "@/lib/validation/scheduling";
import { type ClinicContext, isUuid } from "./context";

export type { AvailabilityException, TimeRange } from "@/lib/scheduling/slots";
export { hoursForDate } from "@/lib/scheduling/slots";

/** Weekly hours as seven lists of ranges (index 0 = Sunday), sorted by start. */
export async function getWorkingHours(
  ctx: ClinicContext,
): Promise<WorkingHours> {
  const rows = await db
    .select({
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(eq(availabilityRules.clinicId, ctx.clinic.id))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));

  const days: WorkingHours = [[], [], [], [], [], [], []];
  for (const row of rows) {
    days[row.weekday].push({
      start: shortTime(row.startTime),
      end: shortTime(row.endTime),
    });
  }
  return days;
}

/** Replaces the weekly hours in one transaction. */
export async function setWorkingHours(
  ctx: ClinicContext,
  hours: WorkingHours,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(availabilityRules)
      .where(eq(availabilityRules.clinicId, ctx.clinic.id));
    const rows = hours.flatMap((ranges, weekday) =>
      ranges.map((range) => ({
        clinicId: ctx.clinic.id,
        weekday,
        startTime: range.start,
        endTime: range.end,
      })),
    );
    if (rows.length > 0) await tx.insert(availabilityRules).values(rows);
  });
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "working_hours.updated",
    entity: "clinic",
    entityId: ctx.clinic.id,
  });
}

export async function listAvailabilityExceptions(
  ctx: ClinicContext,
  { from, to }: { from?: string; to?: string } = {},
): Promise<AvailabilityException[]> {
  const conditions = [eq(availabilityExceptions.clinicId, ctx.clinic.id)];
  if (from) conditions.push(gte(availabilityExceptions.date, from));
  if (to) conditions.push(lte(availabilityExceptions.date, to));
  const rows = await db
    .select()
    .from(availabilityExceptions)
    .where(and(...conditions))
    .orderBy(asc(availabilityExceptions.date));
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    range:
      row.startTime && row.endTime
        ? { start: shortTime(row.startTime), end: shortTime(row.endTime) }
        : null,
  }));
}

export async function addAvailabilityException(
  ctx: ClinicContext,
  input: { date: string; start: string | null; end: string | null },
): Promise<void> {
  const [row] = await db
    .insert(availabilityExceptions)
    .values({
      clinicId: ctx.clinic.id,
      date: input.date,
      startTime: input.start,
      endTime: input.end,
    })
    .returning({ id: availabilityExceptions.id });
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "availability_exception.created",
    entity: "availability_exception",
    entityId: row.id,
  });
}

export async function removeAvailabilityException(
  ctx: ClinicContext,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await db
    .delete(availabilityExceptions)
    .where(
      and(
        eq(availabilityExceptions.id, id),
        eq(availabilityExceptions.clinicId, ctx.clinic.id),
      ),
    )
    .returning({ id: availabilityExceptions.id });
  if (rows.length === 0) return false;
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "availability_exception.deleted",
    entity: "availability_exception",
    entityId: id,
  });
  return true;
}
