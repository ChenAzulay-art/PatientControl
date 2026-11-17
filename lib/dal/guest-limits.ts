import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, patients } from "@/db/schema";
import type { ClinicContext } from "./context";

/** Size limits for a guest (demo) clinic, so one visitor can't fill the database. */
export const GUEST_LIMITS = { patients: 100, appointments: 300 } as const;

export class GuestLimitError extends Error {
  constructor(kind: keyof typeof GUEST_LIMITS) {
    super(`Guest clinics are limited to ${GUEST_LIMITS[kind]} ${kind}.`);
    this.name = "GuestLimitError";
  }
}

/** Throws when a guest clinic already has as many `kind` rows as allowed. */
export async function checkGuestLimit(
  ctx: ClinicContext,
  kind: keyof typeof GUEST_LIMITS,
): Promise<void> {
  if (!ctx.clinic.isDemo) return;
  const table = kind === "patients" ? patients : appointments;
  const [{ n }] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(table.clinicId, ctx.clinic.id));
  if (n >= GUEST_LIMITS[kind]) throw new GuestLimitError(kind);
}
