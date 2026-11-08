"use server";

import {
  type SaveError,
  type SessionNote,
  getSessionNoteVersion,
  saveDraftSessionNote,
  saveFinalSessionNote,
} from "@/lib/dal/session-notes";
import { requireClinic } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

type Input = { locale: string; appointmentId: string; body: string };
export type SummaryResult =
  { ok: true; note: SessionNote } | { ok: false; error: SaveError | "generic" };

function localeFrom(value: unknown) {
  return isLocale(value) ? value : defaultLocale;
}

/** Autosave while typing. */
export async function saveDraftAction(input: Input): Promise<SummaryResult> {
  const ctx = await requireClinic(localeFrom(input.locale));
  if (typeof input.body !== "string") return { ok: false, error: "generic" };
  return saveDraftSessionNote(ctx, String(input.appointmentId), input.body);
}

/** "Save summary" / "Save changes": final, with a new version kept. */
export async function saveFinalAction(input: Input): Promise<SummaryResult> {
  const ctx = await requireClinic(localeFrom(input.locale));
  if (typeof input.body !== "string") return { ok: false, error: "generic" };
  return saveFinalSessionNote(ctx, String(input.appointmentId), input.body);
}

export async function getVersionAction(input: {
  locale: string;
  versionId: string;
}): Promise<string | null> {
  const ctx = await requireClinic(localeFrom(input.locale));
  return (
    (await getSessionNoteVersion(ctx, String(input.versionId)))?.body ?? null
  );
}
