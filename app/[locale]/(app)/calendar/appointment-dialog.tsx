"use client";

import { CalendarClock, ExternalLink, NotebookPen, Search } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { FormMessage } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { AppointmentStatus } from "@/db/schema";
import type { AppointmentView } from "@/lib/dal/appointments";
import type { TreatmentType } from "@/lib/dal/treatment-types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { formatPhone } from "@/lib/validation/phone";
import { searchPatients } from "../patients/actions";
import {
  type AppointmentFormState,
  saveAppointment,
  setStatusAction,
} from "./actions";

export type DialogMode =
  | {
      kind: "new";
      patient?: { id: string; fullName: string };
      date: string;
      time: string;
      durationMinutes?: number;
    }
  | { kind: "existing"; appointment: AppointmentView };

type Props = {
  locale: Locale;
  t: Dictionary["appointment"];
  timezone: string;
  treatmentTypes: TreatmentType[];
  mode: DialogMode | null;
  onClose: () => void;
  onChanged: () => void;
};

export function AppointmentDialog({
  locale,
  t,
  timezone,
  treatmentTypes,
  mode,
  onClose,
  onChanged,
}: Props) {
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {mode?.kind === "new" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.newTitle}</DialogTitle>
            </DialogHeader>
            <AppointmentForm
              key={`${mode.date}-${mode.time}-${mode.patient?.id ?? ""}`}
              locale={locale}
              t={t}
              treatmentTypes={treatmentTypes}
              initial={{
                patient: mode.patient ?? null,
                treatmentTypeId: "",
                date: mode.date,
                time: mode.time,
                durationMinutes: mode.durationMinutes ?? 60,
              }}
              onSaved={() => {
                onChanged();
                onClose();
              }}
            />
          </>
        ) : null}
        {mode?.kind === "existing" ? (
          <AppointmentDetails
            key={mode.appointment.id}
            locale={locale}
            t={t}
            timezone={timezone}
            treatmentTypes={treatmentTypes}
            appointment={mode.appointment}
            onChanged={() => {
              onChanged();
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Details of an existing appointment ---------- */

const statusVariant: Record<
  AppointmentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  scheduled: "outline",
  confirmed: "secondary",
  completed: "default",
  cancelled: "outline",
  no_show: "destructive",
};

export function StatusBadge({
  status,
  t,
}: {
  status: AppointmentStatus;
  t: Dictionary["appointment"];
}) {
  return (
    <Badge
      variant={statusVariant[status]}
      className={status === "cancelled" ? "line-through" : undefined}
    >
      {t.status[status]}
    </Badge>
  );
}

function AppointmentDetails({
  locale,
  t,
  timezone,
  treatmentTypes,
  appointment,
  onChanged,
}: {
  locale: Locale;
  t: Dictionary["appointment"];
  timezone: string;
  treatmentTypes: TreatmentType[];
  appointment: AppointmentView;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = DateTime.fromISO(appointment.startsAt, {
    zone: timezone,
  }).setLocale(locale === "he" ? "he-IL" : "en-IL");
  const end = DateTime.fromISO(appointment.endsAt, { zone: timezone });
  const minutes = Math.round(end.diff(start, "minutes").minutes);

  function changeStatus(status: AppointmentStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setStatusAction({
        locale,
        appointmentId: appointment.id,
        status,
      });
      if (result.ok) onChanged();
      else setError(t.errors[result.error] ?? t.errors.generic);
    });
  }

  const actions: { status: AppointmentStatus; label: string }[] =
    appointment.status === "cancelled"
      ? [{ status: "scheduled", label: t.actions.restore }]
      : [
          ...(appointment.status === "scheduled"
            ? [{ status: "confirmed" as const, label: t.actions.confirm }]
            : []),
          ...(appointment.status !== "completed"
            ? [{ status: "completed" as const, label: t.actions.complete }]
            : []),
          ...(appointment.status !== "no_show"
            ? [{ status: "no_show" as const, label: t.actions.noShow }]
            : []),
          { status: "cancelled", label: t.actions.cancel },
        ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {appointment.patientName}
          <StatusBadge status={appointment.status} t={t} />
        </DialogTitle>
        <DialogDescription>
          {start.toLocaleString({
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {" · "}
          <span dir="ltr">
            {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")}
          </span>
          {" · "}
          {format(t.minutes, { n: String(minutes) })}
          {appointment.treatmentName ? ` · ${appointment.treatmentName}` : ""}
        </DialogDescription>
      </DialogHeader>

      <FormMessage message={error} />

      {editing ? (
        <AppointmentForm
          locale={locale}
          t={t}
          treatmentTypes={treatmentTypes}
          appointmentId={appointment.id}
          initial={{
            patient: {
              id: appointment.patientId,
              fullName: appointment.patientName,
            },
            treatmentTypeId: appointment.treatmentTypeId ?? "",
            date: start.toISODate()!,
            time: start.toFormat("HH:mm"),
            durationMinutes: minutes,
          }}
          lockPatient
          onSaved={onChanged}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.status}
                type="button"
                size="sm"
                variant={
                  action.status === "cancelled" ? "destructive" : "secondary"
                }
                disabled={pending}
                onClick={() => changeStatus(action.status)}
              >
                {action.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {appointment.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <CalendarClock aria-hidden />
                {t.reschedule}
              </Button>
            ) : null}
            {appointment.status !== "cancelled" &&
            appointment.status !== "no_show" ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/${locale}/patients/${appointment.patientId}/sessions/${appointment.id}`}
                >
                  <NotebookPen aria-hidden />
                  {t.writeSummary}
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link href={`/${locale}/patients/${appointment.patientId}`}>
                <ExternalLink aria-hidden />
                {t.openPatient}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Booking / rescheduling form ---------- */

type FormInitial = {
  patient: { id: string; fullName: string } | null;
  treatmentTypeId: string;
  date: string;
  time: string;
  durationMinutes: number;
};

function AppointmentForm({
  locale,
  t,
  treatmentTypes,
  initial,
  appointmentId,
  lockPatient = false,
  onSaved,
  onCancel,
}: {
  locale: Locale;
  t: Dictionary["appointment"];
  treatmentTypes: TreatmentType[];
  initial: FormInitial;
  appointmentId?: string;
  lockPatient?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    AppointmentFormState,
    FormData
  >(saveAppointment, {});
  const [patient, setPatient] = useState(initial.patient);
  const [treatmentTypeId, setTreatmentTypeId] = useState(
    initial.treatmentTypeId,
  );
  const [duration, setDuration] = useState(String(initial.durationMinutes));

  // Run once per successful save, even if the parent re-renders.
  const handled = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.savedAt && handled.current !== state.savedAt) {
      handled.current = state.savedAt;
      onSaved();
    }
  }, [state.savedAt, onSaved]);

  const fieldError = (
    field: keyof NonNullable<AppointmentFormState["fieldErrors"]>,
  ) => {
    const code = state.fieldErrors?.[field];
    return code ? t.errors[code] : null;
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {appointmentId ? (
        <input type="hidden" name="appointmentId" value={appointmentId} />
      ) : null}
      <input type="hidden" name="patientId" value={patient?.id ?? ""} />

      <FormMessage message={state.error ? t.errors[state.error] : null} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" id="appointment-patient-label">
          {t.patient}
        </span>
        {patient ? (
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <span className="font-medium">{patient.fullName}</span>
            {lockPatient ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPatient(null)}
              >
                {t.changePatient}
              </Button>
            )}
          </div>
        ) : (
          <PatientPicker locale={locale} t={t} onPick={setPatient} />
        )}
        <FieldError>{fieldError("patientId")}</FieldError>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t.treatmentType}</span>
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
          <NativeSelectOption value="">{t.noTreatmentType}</NativeSelectOption>
          {treatmentTypes.map((type) => (
            <NativeSelectOption key={type.id} value={type.id}>
              {type.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.date}</span>
          <Input
            name="date"
            type="date"
            required
            defaultValue={initial.date}
            aria-invalid={state.fieldErrors?.date ? true : undefined}
          />
          <FieldError>{fieldError("date")}</FieldError>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.time}</span>
          <Input
            name="time"
            type="time"
            step={300}
            required
            defaultValue={initial.time}
            aria-invalid={state.fieldErrors?.time ? true : undefined}
          />
          <FieldError>{fieldError("time")}</FieldError>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t.duration}</span>
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
            aria-invalid={state.fieldErrors?.durationMinutes ? true : undefined}
          />
          <FieldError>{fieldError("durationMinutes")}</FieldError>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {appointmentId ? t.saveChanges : t.save}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.close}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function PatientPicker({
  locale,
  t,
  onPick,
}: {
  locale: Locale;
  t: Dictionary["appointment"];
  onPick: (patient: { id: string; fullName: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; fullName: string; phone: string }[] | null
  >(null);
  const [, startTransition] = useTransition();
  const latest = useRef(0);

  useEffect(() => {
    const term = query.trim();
    const request = ++latest.current;
    if (!term) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchPatients({
          locale,
          query: term,
          archived: false,
        });
        if (request === latest.current) setResults(found.slice(0, 8));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, locale]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.patientSearch}
          aria-labelledby="appointment-patient-label"
          className="ps-8"
          autoComplete="off"
          autoFocus
        />
      </div>
      {results === null || !query.trim() ? null : results.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {t.patientNoResults}
        </p>
      ) : (
        <ul
          className="max-h-48 overflow-y-auto rounded-md border"
          aria-label={t.patient}
        >
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() =>
                  onPick({ id: result.id, fullName: result.fullName })
                }
              >
                <span>{result.fullName}</span>
                <span dir="ltr" className="text-sm text-muted-foreground">
                  {formatPhone(result.phone)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
