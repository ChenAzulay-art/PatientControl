import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { treatmentTypes } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { type ClinicContext, isUniqueViolation, isUuid } from "./context";

export type TreatmentType = { id: string; name: string; active: boolean };

export async function listTreatmentTypes(
  ctx: ClinicContext,
  { includeInactive = false } = {},
): Promise<TreatmentType[]> {
  return db
    .select({
      id: treatmentTypes.id,
      name: treatmentTypes.name,
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
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: "duplicate" }> {
  try {
    const [row] = await db
      .insert(treatmentTypes)
      .values({ clinicId: ctx.clinic.id, name })
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
