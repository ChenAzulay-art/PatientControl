"use client";

import type {
  EventDropArg,
  EventInput,
  EventSourceFuncArg,
} from "@fullcalendar/core";
import heLocale from "@fullcalendar/core/locales/he";
import interactionPlugin, {
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Plus } from "lucide-react";
import { DateTime } from "luxon";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { AppointmentView } from "@/lib/dal/appointments";
import type { TreatmentType } from "@/lib/dal/treatment-types";
import { localeDirection, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { colorOf } from "@/lib/scheduling/colors";
import type { WorkingHours } from "@/lib/validation/scheduling";
import { fetchAppointments, moveAppointmentAction } from "./actions";
import { AppointmentDialog, type DialogMode } from "./appointment-dialog";

type Props = {
  locale: Locale;
  t: {
    calendar: Dictionary["calendar"];
    appointment: Dictionary["appointment"];
  };
  timezone: string;
  treatmentTypes: TreatmentType[];
  workingHours: WorkingHours;
  /** Opens the booking dialog for this patient straight away (from the patient card). */
  presetPatient?: { id: string; fullName: string } | null;
};

/** Visible hours: an hour around the working hours, or 07:00–21:00 by default. */
function visibleHours(hours: WorkingHours) {
  const ranges = hours.flat();
  if (ranges.length === 0) return { min: "07:00", max: "21:00" };
  const toHour = (time: string, round: "down" | "up") => {
    const [h, m] = time.split(":").map(Number);
    return round === "down" ? h : m > 0 ? h + 1 : h;
  };
  const min = Math.max(
    0,
    Math.min(...ranges.map((r) => toHour(r.start, "down"))) - 1,
  );
  const max = Math.min(
    24,
    Math.max(...ranges.map((r) => toHour(r.end, "up"))) + 1,
  );
  const pad = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return { min: pad(min), max: pad(max) };
}

function toEvent(appointment: AppointmentView): EventInput {
  const color = colorOf(appointment.color);
  const cancelled = appointment.status === "cancelled";
  return {
    id: appointment.id,
    title: appointment.treatmentName
      ? `${appointment.patientName} · ${appointment.treatmentName}`
      : appointment.patientName,
    start: appointment.startsAt,
    end: appointment.endsAt,
    backgroundColor: color.background,
    borderColor: color.border,
    textColor: color.text,
    editable: !cancelled,
    classNames: [`appointment-${appointment.status}`],
    extendedProps: { appointment },
  };
}

const NARROW_QUERY = "(max-width: 640px)";

function subscribeToNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The next half hour from now, in the clinic's time zone. */
function nextSlot(timezone: string) {
  const now = DateTime.now().setZone(timezone);
  const rounded = now
    .plus({ minutes: 30 - (now.minute % 30) })
    .startOf("minute");
  return { date: rounded.toISODate()!, time: rounded.toFormat("HH:mm") };
}

export function CalendarView({
  locale,
  t,
  timezone,
  treatmentTypes,
  workingHours,
  presetPatient,
}: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  // Coming from a patient card: open the booking dialog for that patient.
  const [mode, setMode] = useState<DialogMode | null>(() =>
    presetPatient
      ? { kind: "new", patient: presetPatient, ...nextSlot(timezone) }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  // Day view on phones, week view otherwise (unknown until the browser renders).
  const narrow = useSyncExternalStore(
    subscribeToNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => null,
  );
  const [showCancelled, setShowCancelled] = useState(false);

  useEffect(() => {
    calendarRef.current
      ?.getApi()
      .changeView(narrow ? "timeGridDay" : "timeGridWeek");
  }, [narrow]);

  const refetch = useCallback(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, []);

  useEffect(() => {
    refetch();
  }, [showCancelled, refetch]);

  const loadEvents = useCallback(
    (
      info: EventSourceFuncArg,
      success: (events: EventInput[]) => void,
      failure: (error: Error) => void,
    ) => {
      fetchAppointments({
        locale,
        from: info.start.toISOString(),
        to: info.end.toISOString(),
        includeCancelled: showCancelled,
      })
        .then((appointments) => {
          setError(null);
          success(appointments.map(toEvent));
        })
        .catch((reason: Error) => {
          setError(t.calendar.loadError);
          failure(reason);
        });
    },
    [locale, showCancelled, t.calendar.loadError],
  );

  async function saveMove(info: EventDropArg | EventResizeDoneArg) {
    const { event } = info;
    if (!event.start || !event.end) return info.revert();
    const result = await moveAppointmentAction({
      locale,
      appointmentId: event.id,
      startsAt: event.start.toISOString(),
      endsAt: event.end.toISOString(),
    });
    if (result.ok) {
      setError(null);
      refetch();
    } else {
      info.revert();
      setError(
        result.error === "overlap"
          ? t.appointment.errors.overlap
          : t.calendar.moveError,
      );
    }
  }

  const hours = visibleHours(workingHours);
  const businessHours = workingHours.flatMap((ranges, weekday) =>
    ranges.map((range) => ({
      daysOfWeek: [weekday],
      startTime: range.start,
      endTime: range.end,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          onClick={() => setMode({ kind: "new", ...nextSlot(timezone) })}
        >
          <Plus aria-hidden />
          {t.calendar.newAppointment}
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(event) => setShowCancelled(event.target.checked)}
            className="size-4 accent-primary"
          />
          {t.calendar.showCancelled}
        </label>
      </div>

      <FormMessage message={error} />

      <div className="clinic-calendar rounded-lg border bg-card p-2 sm:p-3">
        {narrow === null ? null : (
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
            initialView={narrow ? "timeGridDay" : "timeGridWeek"}
            locales={[heLocale]}
            locale={locale === "he" ? "he" : "en-gb"}
            direction={localeDirection[locale]}
            timeZone={timezone}
            firstDay={0}
            headerToolbar={{
              start: "prev,next today",
              center: "title",
              end: "timeGridDay,timeGridWeek",
            }}
            height="auto"
            allDaySlot={false}
            nowIndicator
            slotMinTime={hours.min}
            slotMaxTime={hours.max}
            slotDuration="00:30:00"
            snapDuration="00:05:00"
            slotLabelFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            businessHours={businessHours.length > 0 ? businessHours : false}
            events={loadEvents}
            selectable
            selectMirror
            editable
            eventDurationEditable
            select={(info) => {
              const start = DateTime.fromJSDate(info.start).setZone(timezone);
              const end = DateTime.fromJSDate(info.end).setZone(timezone);
              const minutes = Math.round(end.diff(start, "minutes").minutes);
              setMode({
                kind: "new",
                date: start.toISODate()!,
                time: start.toFormat("HH:mm"),
                // A single click selects one slot; keep the usual 60 minutes then.
                durationMinutes: minutes > 30 ? minutes : 60,
              });
              info.view.calendar.unselect();
            }}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              setMode({
                kind: "existing",
                appointment: info.event.extendedProps
                  .appointment as AppointmentView,
              });
            }}
            eventDrop={saveMove}
            eventResize={saveMove}
          />
        )}
      </div>

      <AppointmentDialog
        locale={locale}
        t={t.appointment}
        timezone={timezone}
        treatmentTypes={treatmentTypes}
        mode={mode}
        onClose={() => setMode(null)}
        onChanged={refetch}
      />
    </div>
  );
}
