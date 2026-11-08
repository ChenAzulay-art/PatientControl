"use client";

import { NotebookPen, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { TreatmentType } from "@/lib/dal/treatment-types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type PastSessionState,
  recordPastSession,
} from "./add-summary-actions";

export type PendingSession = {
  appointmentId: string;
  /** Already formatted for display, e.g. "יום ב׳, 9 בנוב׳ · 11:00". */
  label: string;
  treatmentName: string | null;
  hasDraft: boolean;
};

/**
 * "Add treatment summary" on the patient card: pick a past session that has
 * no summary yet, or record a session that was never booked and write its
 * summary.
 */
export function AddSummaryDialog({
  locale,
  t,
  appointmentT,
  patientId,
  pending,
  treatmentTypes,
  today,
}: {
  locale: Locale;
  t: Dictionary["patients"]["card"];
  appointmentT: Dictionary["appointment"];
  patientId: string;
  pending: PendingSession[];
  treatmentTypes: TreatmentType[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, saving] = useActionState<
    PastSessionState,
    FormData
  >(recordPastSession, {});
  const [treatmentTypeId, setTreatmentTypeId] = useState("");
  const [duration, setDuration] = useState("60");

  const fieldError = (
    field: keyof NonNullable<PastSessionState["fieldErrors"]>,
  ) => {
    const code = state.fieldErrors?.[field];
    return code ? appointmentT.errors[code] : null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus aria-hidden />
          {t.addSummary}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.addSummaryTitle}</DialogTitle>
          <DialogDescription>{t.addSummaryDescription}</DialogDescription>
        </DialogHeader>

        {pending.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t.pendingSessions}</h3>
            <ul className="divide-y rounded-md border">
              {pending.map((session) => (
                <li key={session.appointmentId}>
                  <Link
                    href={`/${locale}/patients/${patientId}/sessions/${session.appointmentId}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <NotebookPen
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="font-medium">{session.label}</span>
                    {session.treatmentName ? (
                      <span className="text-sm text-muted-foreground">
                        {session.treatmentName}
                      </span>
                    ) : null}
                    {session.hasDraft ? (
                      <Badge variant="outline">{t.draftBadge}</Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-medium">{t.otherSession}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.otherSessionHint}
            </p>
          </div>
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="patientId" value={patientId} />
            <FormMessage
              message={state.error ? appointmentT.errors[state.error] : null}
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{appointmentT.treatmentType}</span>
              <NativeSelect
                name="treatmentTypeId"
                value={treatmentTypeId}
                onChange={(event) => {
                  const id = event.target.value;
                  setTreatmentTypeId(id);
                  const type = treatmentTypes.find((item) => item.id === id);
                  if (type) setDuration(String(type.durationMinutes));
                }}
              >
                <NativeSelectOption value="">
                  {appointmentT.noTreatmentType}
                </NativeSelectOption>
                {treatmentTypes.map((type) => (
                  <NativeSelectOption key={type.id} value={type.id}>
                    {type.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{appointmentT.date}</span>
                <Input
                  name="date"
                  type="date"
                  required
                  max={today}
                  defaultValue={today}
                  aria-invalid={state.fieldErrors?.date ? true : undefined}
                />
                <FieldError>{fieldError("date")}</FieldError>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{appointmentT.time}</span>
                <Input
                  name="time"
                  type="time"
                  step={300}
                  required
                  aria-invalid={state.fieldErrors?.time ? true : undefined}
                />
                <FieldError>{fieldError("time")}</FieldError>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{appointmentT.duration}</span>
                <Input
                  name="durationMinutes"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={480}
                  step={5}
                  required
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  aria-invalid={
                    state.fieldErrors?.durationMinutes ? true : undefined
                  }
                />
                <FieldError>{fieldError("durationMinutes")}</FieldError>
              </label>
            </div>
            <div>
              <Button type="submit" disabled={saving}>
                {t.continueToSummary}
              </Button>
            </div>
          </form>
        </section>
      </DialogContent>
    </Dialog>
  );
}
