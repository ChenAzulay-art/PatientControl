import "server-only";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { member, organization, user, verification } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { ClinicContext } from "./context";

export type DeleteAccountBlocker = "notOwner" | "otherMembers";

export type DeleteAccountResult =
  { ok: true } | { ok: false; error: DeleteAccountBlocker };

/**
 * Why this user can't delete the clinic, or null if they can: only the
 * owner can, and only while nobody else is a member, so a future staff
 * account can never wipe the practitioner's records.
 */
export async function accountDeletionBlocker(
  ctx: ClinicContext,
): Promise<DeleteAccountBlocker | null> {
  if (ctx.clinic.role !== "owner") return "notOwner";
  const [{ others }] = await db
    .select({ others: count() })
    .from(member)
    .where(
      and(
        eq(member.organizationId, ctx.clinic.id),
        ne(member.userId, ctx.user.id),
      ),
    );
  return others > 0 ? "otherMembers" : null;
}

/**
 * Permanently deletes the clinic with everything in it (patients,
 * appointments, summaries, reminders, settings) and then the practitioner's
 * own account (sign-ins, two-step verification, sessions). See
 * `accountDeletionBlocker` for who may. The audit log keeps an entry with
 * the clinic's id only.
 */
export async function deleteClinicAccount(
  ctx: ClinicContext,
): Promise<DeleteAccountResult> {
  const blocker = await accountDeletionBlocker(ctx);
  if (blocker) return { ok: false, error: blocker };

  await db.transaction(async (tx) => {
    // Every clinic table cascades from the organization.
    await tx.delete(organization).where(eq(organization.id, ctx.clinic.id));
    // Password-reset tokens point at the user by id.
    await tx.delete(verification).where(eq(verification.value, ctx.user.id));
    // Sessions, sign-in methods and two-step secrets cascade from the user.
    await tx.delete(user).where(eq(user.id, ctx.user.id));
  });

  await recordAudit({
    action: "account.deleted",
    entity: "clinic",
    entityId: ctx.clinic.id,
  });
  return { ok: true };
}
