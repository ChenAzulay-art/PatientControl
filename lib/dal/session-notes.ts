import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  type AppointmentStatus,
  patients,
  sessionNotes,
  sessionNoteVersions,
  type SessionNoteStatus,
  treatmentTypes,
  user,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/crypto";
import { type ClinicContext, isUuid } from "./context";

/** Appointments that can have a summary: not cancelled, and the patient came. */
const SUMMARIZABLE: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "completed",
];

export const SUMMARY_MAX_LENGTH = 20_000;

export type SessionNote = {
  id: string;
  body: string;
  status: SessionNoteStatus;
  finalizedAt: string | null;
  updatedAt: string;
};

export type SessionNoteVersion = {
  id: string;
  savedAt: string;
  savedBy: string | null;
};

export type SessionForEditing = {
  appointment: {
    id: string;
    patientId: string;
    patientName: string;
    treatmentName: string | null;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
  };
  note: SessionNote | null;
  versions: SessionNoteVersion[];
};

export type SaveError = "notFound" | "notAllowed" | "alreadyFinal" | "empty";
type SaveResult =
  { ok: true; note: SessionNote } | { ok: false; error: SaveError };

/**
 * encrypt() keeps empty values as null, but a draft's text column can't be
 * null, so an empty draft is stored as one encrypted space and read back as "".
 */
const EMPTY_DRAFT = " ";
function sealBody(text: string): string {
  return encrypt(text === "" ? EMPTY_DRAFT : text)!;
}
function openBody(sealed: string): string {
  const text = decrypt(sealed) ?? "";
  return text === EMPTY_DRAFT ? "" : text;
}

function toNote(row: typeof sessionNotes.$inferSelect): SessionNote {
  return {
    id: row.id,
    body: openBody(row.bodyEncrypted),
    status: row.status,
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function audit(ctx: ClinicContext, action: string, entityId: string) {
  await recordAudit({
    actorId: ctx.user.id,
    clinicId: ctx.clinic.id,
    action,
    entity: "session_note",
    entityId,
  });
}

/** The appointment (in this clinic) a summary would belong to. */
async function findAppointment(ctx: ClinicContext, appointmentId: string) {
  if (!isUuid(appointmentId)) return null;
  const [row] = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      patientName: patients.fullName,
      treatmentName: treatmentTypes.name,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
    })
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
    )
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.clinicId, ctx.clinic.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function findNote(ctx: ClinicContext, appointmentId: string) {
  const [row] = await db
    .select()
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.appointmentId, appointmentId),
        eq(sessionNotes.clinicId, ctx.clinic.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Everything the summary page needs. Opening it is recorded in the audit log. */
export async function getSessionForEditing(
  ctx: ClinicContext,
  appointmentId: string,
): Promise<SessionForEditing | null> {
  const appointment = await findAppointment(ctx, appointmentId);
  if (!appointment) return null;
  const note = await findNote(ctx, appointment.id);

  const versions = note
    ? await db
        .select({
          id: sessionNoteVersions.id,
          savedAt: sessionNoteVersions.savedAt,
          savedBy: user.name,
        })
        .from(sessionNoteVersions)
        .leftJoin(user, eq(user.id, sessionNoteVersions.savedBy))
        .where(
          and(
            eq(sessionNoteVersions.noteId, note.id),
            eq(sessionNoteVersions.clinicId, ctx.clinic.id),
          ),
        )
        .orderBy(desc(sessionNoteVersions.savedAt))
    : [];

  if (note) await audit(ctx, "session_note.viewed", note.id);

  return {
    appointment: {
      ...appointment,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
    },
    note: note ? toNote(note) : null,
    versions: versions.map((version) => ({
      id: version.id,
      savedAt: version.savedAt.toISOString(),
      savedBy: version.savedBy,
    })),
  };
}

/** One earlier version's text, for comparing with the current summary. */
export async function getSessionNoteVersion(
  ctx: ClinicContext,
  versionId: string,
): Promise<{ body: string; savedAt: string } | null> {
  if (!isUuid(versionId)) return null;
  const [row] = await db
    .select()
    .from(sessionNoteVersions)
    .where(
      and(
        eq(sessionNoteVersions.id, versionId),
        eq(sessionNoteVersions.clinicId, ctx.clinic.id),
      ),
    )
    .limit(1);
  if (!row) return null;
  await audit(ctx, "session_note_version.viewed", row.id);
  return {
    body: openBody(row.bodyEncrypted),
    savedAt: row.savedAt.toISOString(),
  };
}

/**
 * Saves a draft while the practitioner types. Drafts have no history; once
 * the summary is final, changes go through saveFinalSessionNote instead.
 */
export async function saveDraftSessionNote(
  ctx: ClinicContext,
  appointmentId: string,
  body: string,
): Promise<SaveResult> {
  const appointment = await findAppointment(ctx, appointmentId);
  if (!appointment) return { ok: false, error: "notFound" };
  if (!SUMMARIZABLE.includes(appointment.status)) {
    return { ok: false, error: "notAllowed" };
  }
  const text = body.slice(0, SUMMARY_MAX_LENGTH);

  const existing = await findNote(ctx, appointment.id);
  if (existing?.status === "final") return { ok: false, error: "alreadyFinal" };

  const [row] = existing
    ? await db
        .update(sessionNotes)
        .set({ bodyEncrypted: sealBody(text) })
        .where(
          and(
            eq(sessionNotes.id, existing.id),
            eq(sessionNotes.clinicId, ctx.clinic.id),
            eq(sessionNotes.status, "draft"),
          ),
        )
        .returning()
    : await db
        .insert(sessionNotes)
        .values({
          clinicId: ctx.clinic.id,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          bodyEncrypted: sealBody(text),
          authorId: ctx.user.id,
        })
        .onConflictDoNothing()
        .returning();
  // Another tab finished it in the meantime.
  if (!row) return { ok: false, error: "alreadyFinal" };

  if (!existing) await audit(ctx, "session_note.draft_created", row.id);
  return { ok: true, note: toNote(row) };
}

/**
 * Saves the summary as final, keeping this text as a new version. The
 * first time, an appointment still marked scheduled or confirmed is marked
 * completed.
 */
export async function saveFinalSessionNote(
  ctx: ClinicContext,
  appointmentId: string,
  body: string,
): Promise<SaveResult> {
  const text = body.trim().slice(0, SUMMARY_MAX_LENGTH);
  if (!text) return { ok: false, error: "empty" };

  const appointment = await findAppointment(ctx, appointmentId);
  if (!appointment) return { ok: false, error: "notFound" };
  if (!SUMMARIZABLE.includes(appointment.status)) {
    return { ok: false, error: "notAllowed" };
  }

  const { row, firstTime } = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(sessionNotes)
      .where(
        and(
          eq(sessionNotes.appointmentId, appointment.id),
          eq(sessionNotes.clinicId, ctx.clinic.id),
        ),
      )
      .limit(1);
    const sealed = sealBody(text);
    const now = new Date();

    const [saved] = existing
      ? await tx
          .update(sessionNotes)
          .set({
            bodyEncrypted: sealed,
            status: "final",
            finalizedAt: existing.finalizedAt ?? now,
          })
          .where(
            and(
              eq(sessionNotes.id, existing.id),
              eq(sessionNotes.clinicId, ctx.clinic.id),
            ),
          )
          .returning()
      : await tx
          .insert(sessionNotes)
          .values({
            clinicId: ctx.clinic.id,
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            bodyEncrypted: sealed,
            status: "final",
            finalizedAt: now,
            authorId: ctx.user.id,
          })
          .returning();

    await tx.insert(sessionNoteVersions).values({
      clinicId: ctx.clinic.id,
      noteId: saved.id,
      bodyEncrypted: sealed,
      savedBy: ctx.user.id,
    });

    if (appointment.status !== "completed") {
      await tx
        .update(appointments)
        .set({ status: "completed" })
        .where(
          and(
            eq(appointments.id, appointment.id),
            eq(appointments.clinicId, ctx.clinic.id),
          ),
        );
    }
    return { row: saved, firstTime: existing?.status !== "final" };
  });

  await audit(
    ctx,
    firstTime ? "session_note.finalized" : "session_note.edited",
    row.id,
  );
  return { ok: true, note: toNote(row) };
}

export type TimelineEntry = {
  noteId: string;
  appointmentId: string;
  startsAt: string;
  treatmentName: string | null;
  status: SessionNoteStatus;
  body: string;
  updatedAt: string;
  versionCount: number;
};

/** A patient's summaries, newest session first, decrypted for their card. */
export async function listPatientSessionNotes(
  ctx: ClinicContext,
  patientId: string,
): Promise<TimelineEntry[]> {
  if (!isUuid(patientId)) return [];
  const rows = await db
    .select({
      note: sessionNotes,
      startsAt: appointments.startsAt,
      treatmentName: treatmentTypes.name,
      versionCount: sql<number>`(select count(*)::int from ${sessionNoteVersions} v where v.note_id = ${sessionNotes.id} and v.clinic_id = ${sessionNotes.clinicId})`,
    })
    .from(sessionNotes)
    .innerJoin(
      appointments,
      and(
        eq(appointments.id, sessionNotes.appointmentId),
        eq(appointments.clinicId, sessionNotes.clinicId),
      ),
    )
    .leftJoin(
      treatmentTypes,
      and(
        eq(treatmentTypes.id, appointments.treatmentTypeId),
        eq(treatmentTypes.clinicId, appointments.clinicId),
      ),
    )
    .where(
      and(
        eq(sessionNotes.clinicId, ctx.clinic.id),
        eq(sessionNotes.patientId, patientId),
      ),
    )
    .orderBy(desc(appointments.startsAt));

  return rows.map(({ note, startsAt, treatmentName, versionCount }) => ({
    noteId: note.id,
    appointmentId: note.appointmentId,
    startsAt: startsAt.toISOString(),
    treatmentName,
    status: note.status,
    body: openBody(note.bodyEncrypted),
    updatedAt: note.updatedAt.toISOString(),
    versionCount: Number(versionCount),
  }));
}

/** For a list of appointments, which ones have a draft or a final summary. */
export async function summaryStatusFor(
  ctx: ClinicContext,
  appointmentIds: string[],
): Promise<Map<string, SessionNoteStatus>> {
  const ids = appointmentIds.filter(isUuid);
  const statuses = new Map<string, SessionNoteStatus>();
  if (ids.length === 0) return statuses;
  const rows = await db
    .select({
      appointmentId: sessionNotes.appointmentId,
      status: sessionNotes.status,
    })
    .from(sessionNotes)
    .where(
      and(
        eq(sessionNotes.clinicId, ctx.clinic.id),
        inArray(sessionNotes.appointmentId, ids),
      ),
    );
  for (const row of rows) statuses.set(row.appointmentId, row.status);
  return statuses;
}

export type MissingSummary = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  treatmentName: string | null;
  startsAt: string;
  hasDraft: boolean;
};

/**
 * Sessions that already ended (in the last `days` days), weren't cancelled
 * or missed, and have no final summary yet. Oldest first.
 */
export async function listSessionsMissingSummary(
  ctx: ClinicContext,
  { now = new Date(), days = 30 }: { now?: Date; days?: number } = {},
): Promise<MissingSummary[]> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await db
    .select({
      appointmentId: appointments.id,
      patientId: appointments.patientId,
      patientName: patients.fullName,
      treatmentName: treatmentTypes.name,
      startsAt: appointments.startsAt,
      noteStatus: sessionNotes.status,
    })
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
    )
    .leftJoin(
      sessionNotes,
      and(
        eq(sessionNotes.appointmentId, appointments.id),
        eq(sessionNotes.clinicId, appointments.clinicId),
      ),
    )
    .where(
      and(
        eq(appointments.clinicId, ctx.clinic.id),
        inArray(appointments.status, SUMMARIZABLE),
        lt(appointments.endsAt, now),
        gte(appointments.startsAt, since),
        or(isNull(sessionNotes.id), eq(sessionNotes.status, "draft")),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(50);

  return rows.map((row) => ({
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    patientName: row.patientName,
    treatmentName: row.treatmentName,
    startsAt: row.startsAt.toISOString(),
    hasDraft: row.noteStatus === "draft",
  }));
}
