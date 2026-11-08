import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { treatmentTypes } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { TreatmentTypeInput } from "@/lib/validation/scheduling";
import { type ClinicContext, isUniqueViolation, isUuid } from "./context";

export type TreatmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  priceAgorot: number | null;
  color: string;
  bookableOnline: boolean;
  active: boolean;
};

/** Shorthand used by tests and callers that only care about the name. */
const defaults = {
  durationMinutes: 60,
  priceAgorot: null,
  color: "teal",
  bookableOnline: false,
};

export async function listTreatmentTypes(
  ctx: ClinicContext,
  { includeInactive = false } = {},
): Promise<TreatmentType[]> {
  return db
    .select({
      id: treatmentTypes.id,
      name: treatmentTypes.name,
      durationMinutes: treatmentTypes.durationMinutes,
      priceAgorot: treatmentTypes.priceAgorot,
      color: treatmentTypes.color,
      bookableOnline: treatmentTypes.bookableOnline,
      active: treatmentTypes.active,
    })
    .from(treatmentTypes)
    .where(
      includeInactive
        ? eq(treatmentTypes.clinicId, ctx.clinic.id)
        : and(
            eq(treatmentTypes.clinicId, ctx.clinic.id),
            eq(treatmentTypes.active, true),
          ),
    )
    .orderBy(asc(treatmentTypes.sortOrder), asc(treatmentTypes.name));
}

export async function createTreatmentType(
  ctx: ClinicContext,
  input: TreatmentTypeInput | string,
): Promise<{ ok: true; id: string } | { ok: false; error: "duplicate" }> {
  const values =
    typeof input === "string" ? { ...defaults, name: input } : input;
  try {
    const [row] = await db
      .insert(treatmentTypes)
      .values({ clinicId: ctx.clinic.id, ...values })
      .returning({ id: treatmentTypes.id });
    await recordAudit({
      actorId: ctx.user.id,
      clinicId: ctx.clinic.id,
      action: "treatment_type.created",
      entity: "treatment_type",
      entityId: row.id,
    });
    return { ok: true, id: row.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
}

/** Changes name, duration, price or color. Existing appointments keep their times. */
export async function updateTreatmentType(
  ctx: ClinicContext,
  id: string,
  input: TreatmentTypeInput,
): Promise<{ ok: true } | { ok: false; error: "duplicate" | "notFound" }> {
  if (!isUuid(id)) return { ok: false, error: "notFound" };
  try {
    const rows = await db
      .update(treatmentTypes)
      .set(input)
      .where(
        and(
          eq(treatmentTypes.id, id),
          eq(treatmentTypes.clinicId, ctx.clinic.id),
        ),
      )
      .returning({ id: treatmentTypes.id });
    if (rows.length === 0) return { ok: false, error: "notFound" };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "duplicate" };
    throw error;
  }
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: "treatment_type.updated",
    entity: "treatment_type",
    entityId: id,
  });
  return { ok: true };
}

/** Hides a treatment type from new patients without touching existing links. */
export async function setTreatmentTypeActive(
  ctx: ClinicContext,
  id: string,
  active: boolean,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const updated = await db
    .update(treatmentTypes)
    .set({ active })
    .where(
      and(
        eq(treatmentTypes.id, id),
        eq(treatmentTypes.clinicId, ctx.clinic.id),
      ),
    )
    .returning({ id: treatmentTypes.id });
  if (updated.length === 0) return false;
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action: active ? "treatment_type.activated" : "treatment_type.deactivated",
    entity: "treatment_type",
    entityId: id,
  });
  return true;
}

/** Keeps only ids that belong to this clinic, so a forged id is silently dropped. */
export async function ownTreatmentTypeIds(
  ctx: ClinicContext,
  ids: string[],
): Promise<string[]> {
  const candidates = [...new Set(ids.filter(isUuid))];
  if (candidates.length === 0) return [];
  const rows = await db
    .select({ id: treatmentTypes.id })
    .from(treatmentTypes)
    .where(
      and(
        eq(treatmentTypes.clinicId, ctx.clinic.id),
        inArray(treatmentTypes.id, candidates),
      ),
    );
  return rows.map((row) => row.id);
}
