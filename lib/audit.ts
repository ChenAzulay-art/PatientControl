import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditEntry = {
  action: string;
  actorId?: string | null;
  clinicId?: string | null;
  entity?: string;
  entityId?: string;
};

/**
 * Records who did what. Store identifiers only, never patient details,
 * so the log itself doesn't become a second copy of health data.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    action: entry.action,
    actorId: entry.actorId ?? null,
    clinicId: entry.clinicId ?? null,
    entity: entry.entity ?? null,
    entityId: entry.entityId ?? null,
  });
}
