"use client";

import { Check, Lock, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SessionNote } from "@/lib/dal/session-notes";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  saveDraftAction,
  saveFinalAction,
  type SummaryResult,
} from "./actions";

const AUTOSAVE_DELAY_MS = 1500;

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

export function SummaryEditor({
  locale,
  t,
  appointmentId,
  timezone,
  initialNote,
  maxLength,
}: {
  locale: Locale;
  t: Dictionary["summary"];
  appointmentId: string;
  timezone: string;
  initialNote: SessionNote | null;
  maxLength: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [status, setStatus] = useState(initialNote?.status ?? null);
  const [lastSaved, setLastSaved] = useState(initialNote?.body ?? "");
  const [save, setSave] = useState<SaveState>(
    initialNote
      ? { kind: "saved", at: initialNote.updatedAt }
      : { kind: "idle" },
  );
  const [finalizing, startFinalize] = useTransition();
  const latest = useRef(0);

  const isFinal = status === "final";
  const dirty = body !== lastSaved;
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date(iso));

  function errorText(result: Extract<SummaryResult, { ok: false }>) {
    return t.errors[result.error] ?? t.errors.generic;
  }

  // Drafts save themselves a moment after typing stops.
  useEffect(() => {
    if (isFinal || !dirty) return;
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      setSave({ kind: "saving" });
      try {
        const result = await saveDraftAction({ locale, appointmentId, body });
        if (request !== latest.current) return;
        if (result.ok) {
          setLastSaved(body);
          setStatus(result.note.status);
          setSave({ kind: "saved", at: result.note.updatedAt });
        } else {
          setSave({ kind: "error", message: errorText(result) });
        }
      } catch {
        if (request === latest.current) {
          setSave({ kind: "error", message: t.saveError });
        }
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // errorText only reads `t`, which doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, isFinal, dirty, locale, appointmentId]);

  // Warn before leaving with text that isn't saved.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function finalize() {
    // Stop any pending autosave from racing the final save.
    latest.current++;
    startFinalize(async () => {
      try {
        const result = await saveFinalAction({ locale, appointmentId, body });
        if (!result.ok) {
          setSave({ kind: "error", message: errorText(result) });
          return;
        }
        setLastSaved(result.note.body);
        setBody(result.note.body);
        setStatus("final");
        setSave({ kind: "saved", at: result.note.updatedAt });
        // Reload the version history and appointment status.
        router.refresh();
      } catch {
        setSave({ kind: "error", message: t.errors.generic });
      }
    });
  }

  const statusLine =
    save.kind === "saving" || finalizing ? (
      <span className="inline-flex items-center gap-1.5">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t.saving}
      </span>
    ) : dirty ? (
      t.unsaved
    ) : save.kind === "saved" ? (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-4" aria-hidden />
        {format(isFinal ? t.savedAt : t.draftSaved, { time: time(save.at) })}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="summary-body" className="font-medium">
          {t.label}
        </label>
        {status ? (
          <Badge variant={isFinal ? "default" : "outline"}>
            {isFinal ? t.statusFinal : t.statusDraft}
          </Badge>
        ) : null}
      </div>

      <Textarea
        id="summary-body"
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (save.kind !== "saving") setSave({ kind: "dirty" });
        }}
        placeholder={t.placeholder}
        maxLength={maxLength}
        rows={14}
        dir="auto"
        className="min-h-72 text-base leading-relaxed"
        aria-describedby="summary-status summary-help"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span id="summary-status" role="status" aria-live="polite">
          {statusLine}
        </span>
        <span>
          {format(t.length, {
            n: String(body.length),
            max: String(maxLength),
          })}
        </span>
      </div>

      <FormMessage message={save.kind === "error" ? save.message : null} />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={finalize}
          disabled={finalizing || !body.trim() || (isFinal && !dirty)}
        >
          {isFinal ? t.saveChanges : t.finalize}
        </Button>
        <p id="summary-help" className="text-sm text-muted-foreground">
          {isFinal ? t.editedNote : t.completesAppointment}
        </p>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden />
        {t.encryptedNote}
      </p>
    </div>
  );
}
