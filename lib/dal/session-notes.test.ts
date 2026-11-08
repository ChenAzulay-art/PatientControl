// @vitest-environment node
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { makeClinic } from "@/test/db";
import type { ClinicContext } from "./context";

vi.mock("@/db", async () => ({
  db: await (await import("@/test/db")).createTestDb(),
}));

const { db } = await import("@/db");
const { createAppointment, getAppointment, setAppointmentStatus } =
  await import("./appointments");
const { createPatient } = await import("./patients");
const {
  getSessionForEditing,
  getSessionNoteVersion,
  listPatientSessionNotes,
  listSessionsMissingSummary,
  saveDraftSessionNote,
  saveFinalSessionNote,
  summaryStatusFor,
} = await import("./session-notes");

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");

let clinicA: ClinicContext;
let clinicB: ClinicContext;
let patientA: string;
let patientB: string;
let day = 0;

async function addPatient(ctx: ClinicContext, fullName: string) {
  return createPatient(ctx, {
    fullName,
    phone: "+972501234567",
    email: null,
    dateOfBirth: null,
    nationalId: null,
    medicalBackground: null,
    importantNotes: null,
    treatmentTypeIds: [],
    preferredLocale: "he",
    reminderConsent: false,
  });
}

/** A one-hour appointment on its own day, so tests never overlap. */
async function book(ctx: ClinicContext, patientId: string, base = "2026-03") {
  day += 1;
  const date = `${base}-${String((day % 28) + 1).padStart(2, "0")}`;
  const result = await createAppointment(ctx, {
    patientId,
    treatmentTypeId: null,
    date,
    time: `${String(8 + Math.floor(day / 28)).padStart(2, "0")}:00`,
    durationMinutes: 60,
  });
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

beforeAll(async () => {
  clinicA = await makeClinic(db, "notes-a");
  clinicB = await makeClinic(db, "notes-b");
  patientA = await addPatient(clinicA, "Maya A");
  patientB = await addPatient(clinicB, "Ben B");
});

describe("drafts", () => {
  it("creates and updates a draft without keeping versions", async () => {
    const appointmentId = await book(clinicA, patientA);
    const first = await saveDraftSessionNote(
      clinicA,
      appointmentId,
      "Worked on",
    );
    const second = await saveDraftSessionNote(
      clinicA,
      appointmentId,
      "Worked on the left foot",
    );
    expect(first.ok && second.ok).toBe(true);

    const session = await getSessionForEditing(clinicA, appointmentId);
    expect(session?.note).toMatchObject({
      body: "Worked on the left foot",
      status: "draft",
      finalizedAt: null,
    });
    expect(session?.versions).toEqual([]);
  });

  it("keeps an emptied draft empty", async () => {
    const appointmentId = await book(clinicA, patientA);
    await saveDraftSessionNote(clinicA, appointmentId, "x");
    await saveDraftSessionNote(clinicA, appointmentId, "");
    expect(
      (await getSessionForEditing(clinicA, appointmentId))?.note?.body,
    ).toBe("");
  });

  it("stores the text encrypted", async () => {
    const appointmentId = await book(clinicA, patientA);
    await saveFinalSessionNote(
      clinicA,
      appointmentId,
      "Plantar fasciitis, improving",
    );
    const rows = await db
      .select()
      .from(schema.sessionNotes)
      .where(eq(schema.sessionNotes.appointmentId, appointmentId));
    const versions = await db
      .select()
      .from(schema.sessionNoteVersions)
      .where(eq(schema.sessionNoteVersions.noteId, rows[0].id));
    const stored = JSON.stringify({ rows, versions });
    expect(stored).not.toContain("fasciitis");
    expect(rows[0].bodyEncrypted).toMatch(/^v1:/);
  });
});

describe("saving the summary", () => {
  it("finalizes, keeps a version, and completes the appointment", async () => {
    const appointmentId = await book(clinicA, patientA);
    await saveDraftSessionNote(clinicA, appointmentId, "draft text");
    const result = await saveFinalSessionNote(
      clinicA,
      appointmentId,
      "  Final text  ",
    );
    expect(result).toMatchObject({
      ok: true,
      note: { body: "Final text", status: "final" },
    });

    const session = await getSessionForEditing(clinicA, appointmentId);
    expect(session?.versions).toHaveLength(1);
    expect(session?.note?.finalizedAt).not.toBeNull();
    expect((await getAppointment(clinicA, appointmentId))?.status).toBe(
      "completed",
    );
  });

  it("refuses autosave over a final summary and keeps every edit as a version", async () => {
    const appointmentId = await book(clinicA, patientA);
    await saveFinalSessionNote(clinicA, appointmentId, "Version one");
    expect(
      await saveDraftSessionNote(clinicA, appointmentId, "sneaky change"),
    ).toEqual({ ok: false, error: "alreadyFinal" });

    await saveFinalSessionNote(clinicA, appointmentId, "Version two");
    const session = await getSessionForEditing(clinicA, appointmentId);
    expect(session?.note?.body).toBe("Version two");
    expect(session?.versions).toHaveLength(2);

    // Newest first; the oldest still holds the original text.
    const oldest = session!.versions[1];
    expect((await getSessionNoteVersion(clinicA, oldest.id))?.body).toBe(
      "Version one",
    );
  });

  it("keeps the first save time when the summary is edited", async () => {
    const appointmentId = await book(clinicA, patientA);
    const first = await saveFinalSessionNote(clinicA, appointmentId, "One");
    const second = await saveFinalSessionNote(clinicA, appointmentId, "Two");
    if (!first.ok || !second.ok) throw new Error("save failed");
    expect(second.note.finalizedAt).toBe(first.note.finalizedAt);
  });

  it("rejects an empty summary", async () => {
    const appointmentId = await book(clinicA, patientA);
    expect(await saveFinalSessionNote(clinicA, appointmentId, "   ")).toEqual({
      ok: false,
      error: "empty",
    });
  });

  it("doesn't allow summaries for cancelled or missed appointments", async () => {
    const cancelled = await book(clinicA, patientA);
    await setAppointmentStatus(clinicA, cancelled, "cancelled");
    const missed = await book(clinicA, patientA);
    await setAppointmentStatus(clinicA, missed, "no_show");

    for (const id of [cancelled, missed]) {
      expect(await saveDraftSessionNote(clinicA, id, "x")).toEqual({
        ok: false,
        error: "notAllowed",
      });
      expect(await saveFinalSessionNote(clinicA, id, "x")).toEqual({
        ok: false,
        error: "notAllowed",
      });
    }
  });
});

describe("clinic isolation", () => {
  it("can't read or write another clinic's summaries", async () => {
    const theirs = await book(clinicB, patientB);
    await saveFinalSessionNote(clinicB, theirs, "Private notes of clinic B");
    const theirSession = await getSessionForEditing(clinicB, theirs);

    expect(await getSessionForEditing(clinicA, theirs)).toBeNull();
    expect(await saveDraftSessionNote(clinicA, theirs, "x")).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(await saveFinalSessionNote(clinicA, theirs, "x")).toEqual({
      ok: false,
      error: "notFound",
    });
    expect(
      await getSessionNoteVersion(clinicA, theirSession!.versions[0].id),
    ).toBeNull();
    expect(await listPatientSessionNotes(clinicA, patientB)).toEqual([]);
    expect((await summaryStatusFor(clinicA, [theirs])).size).toBe(0);
  });

  it("the database refuses a summary linked to another clinic's appointment", async () => {
    const theirs = await book(clinicB, patientB);
    await expect(
      db.insert(schema.sessionNotes).values({
        clinicId: clinicA.clinic.id,
        appointmentId: theirs,
        patientId: patientA,
        bodyEncrypted: "v1:x",
      }),
    ).rejects.toThrow();
  });
});

describe("timeline and reminders to write", () => {
  it("lists a patient's summaries newest first with version counts", async () => {
    const patient = await addPatient(clinicA, "Timeline");
    const older = await book(clinicA, patient, "2026-04");
    const newer = await book(clinicA, patient, "2026-05");
    await saveFinalSessionNote(clinicA, older, "older v1");
    await saveFinalSessionNote(clinicA, older, "older v2");
    await saveDraftSessionNote(clinicA, newer, "newer draft");

    const timeline = await listPatientSessionNotes(clinicA, patient);
    expect(
      timeline.map((entry) => [entry.body, entry.status, entry.versionCount]),
    ).toEqual([
      ["newer draft", "draft", 0],
      ["older v2", "final", 2],
    ]);
  });

  it("lists ended sessions that still need a summary", async () => {
    const patient = await addPatient(clinicA, "Needs summary");
    const none = await book(clinicA, patient, "2026-06");
    const draft = await book(clinicA, patient, "2026-06");
    const done = await book(clinicA, patient, "2026-06");
    const cancelled = await book(clinicA, patient, "2026-06");
    const future = await book(clinicA, patient, "2026-08");
    await saveDraftSessionNote(clinicA, draft, "half written");
    await saveFinalSessionNote(clinicA, done, "all done");
    await setAppointmentStatus(clinicA, cancelled, "cancelled");

    const missing = await listSessionsMissingSummary(clinicA, {
      now: new Date("2026-07-01T00:00:00Z"),
      days: 40,
    });
    const mine = missing.filter((item) => item.patientId === patient);
    expect(mine.map((item) => [item.appointmentId, item.hasDraft])).toEqual([
      [none, false],
      [draft, true],
    ]);
    expect(mine.some((item) => item.appointmentId === future)).toBe(false);
  });

  it("records views, drafts and saves in the audit log", async () => {
    const appointmentId = await book(clinicA, patientA);
    await saveDraftSessionNote(clinicA, appointmentId, "a");
    await saveFinalSessionNote(clinicA, appointmentId, "b");
    await saveFinalSessionNote(clinicA, appointmentId, "c");
    const session = await getSessionForEditing(clinicA, appointmentId);
    const entries = await db
      .select({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, session!.note!.id));
    expect(entries.map((entry) => entry.action)).toEqual([
      "session_note.draft_created",
      "session_note.finalized",
      "session_note.edited",
      "session_note.viewed",
    ]);
  });
});

describe("adding a summary from the patient card", () => {
  it("records a past session that was never booked, as completed", async () => {
    const patient = await addPatient(clinicA, "Walk-in");
    const now = new Date("2026-07-10T12:00:00Z");
    const result = await createAppointment(
      clinicA,
      {
        patientId: patient,
        treatmentTypeId: null,
        date: "2026-07-09",
        time: "16:00",
        durationMinutes: 45,
      },
      { pastSession: true, now },
    );
    if (!result.ok) throw new Error(result.error);
    expect((await getAppointment(clinicA, result.id))?.status).toBe(
      "completed",
    );
    expect(
      (await saveFinalSessionNote(clinicA, result.id, "Walk-in session")).ok,
    ).toBe(true);
  });

  it("refuses a future time and an overlapping one", async () => {
    const patient = await addPatient(clinicA, "Not yet");
    const now = new Date("2026-07-10T12:00:00Z");
    const session = (date: string, time: string) =>
      createAppointment(
        clinicA,
        {
          patientId: patient,
          treatmentTypeId: null,
          date,
          time,
          durationMinutes: 60,
        },
        { pastSession: true, now },
      );
    expect(await session("2026-07-11", "09:00")).toEqual({
      ok: false,
      error: "notPast",
    });
    expect((await session("2026-07-08", "09:00")).ok).toBe(true);
    expect(await session("2026-07-08", "09:30")).toEqual({
      ok: false,
      error: "overlap",
    });
  });

  it("can't record a session for another clinic's patient", async () => {
    expect(
      await createAppointment(
        clinicA,
        {
          patientId: patientB,
          treatmentTypeId: null,
          date: "2026-07-01",
          time: "09:00",
          durationMinutes: 60,
        },
        { pastSession: true, now: new Date("2026-07-10T12:00:00Z") },
      ),
    ).toEqual({ ok: false, error: "patientNotFound" });
  });

  it("lists one patient's sessions without a summary, newest first", async () => {
    const patient = await addPatient(clinicA, "Two sessions");
    const older = await book(clinicA, patient, "2026-09");
    const newer = await book(clinicA, patient, "2026-10");
    const other = await addPatient(clinicA, "Someone else");
    await book(clinicA, other, "2026-10");

    const list = await listSessionsMissingSummary(clinicA, {
      patientId: patient,
      now: new Date("2026-11-01T00:00:00Z"),
      days: 365,
    });
    expect(list.map((item) => item.appointmentId)).toEqual([newer, older]);
    expect(
      await listSessionsMissingSummary(clinicB, {
        patientId: patient,
        days: 365,
      }),
    ).toEqual([]);
  });
});
