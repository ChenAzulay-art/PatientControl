import { Check, UserX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppointmentView } from "@/lib/dal/appointments";
import { formatDayShort, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { colorOf } from "@/lib/scheduling/colors";
import { setStatusFromForm } from "./actions";
import { StatusBadge } from "./appointment-dialog";

/**
 * A list of appointments with time, treatment and status. `show` picks the
 * patient (dashboard) or the date (patient card) as the main label.
 */
export function AppointmentList({
  locale,
  t,
  timezone,
  appointments,
  show,
  returnTo,
  quickActions = false,
}: {
  locale: Locale;
  t: Dictionary["appointment"];
  timezone: string;
  appointments: AppointmentView[];
  show: "patient" | "date";
  returnTo: string;
  quickActions?: boolean;
}) {
  return (
    <ul className="divide-y rounded-md border">
      {appointments.map((appointment) => {
        const start = new Date(appointment.startsAt);
        const end = new Date(appointment.endsAt);
        const open =
          appointment.status === "scheduled" ||
          appointment.status === "confirmed";
        return (
          <li
            key={appointment.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5"
          >
            <span
              aria-hidden
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ background: colorOf(appointment.color).border }}
            />
            <span className="min-w-28 tabular-nums" dir="ltr">
              {show === "date" ? (
                <span className="me-2" dir="auto">
                  {formatDayShort(locale, start, timezone)}
                </span>
              ) : null}
              {formatTime(locale, start, timezone)}–
              {formatTime(locale, end, timezone)}
            </span>
            <span className="min-w-0 flex-1">
              {show === "patient" ? (
                <Link
                  href={`/${locale}/patients/${appointment.patientId}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {appointment.patientName}
                </Link>
              ) : null}
              {appointment.treatmentName ? (
                <span
                  className={
                    show === "patient"
                      ? "ms-2 text-sm text-muted-foreground"
                      : ""
                  }
                >
                  {appointment.treatmentName}
                </span>
              ) : null}
            </span>
            <StatusBadge status={appointment.status} t={t} />
            {quickActions && open ? (
              <span className="flex gap-1">
                {(
                  [
                    {
                      status: "completed",
                      label: t.actions.complete,
                      Icon: Check,
                    },
                    { status: "no_show", label: t.actions.noShow, Icon: UserX },
                  ] as const
                ).map(({ status, label, Icon }) => (
                  <form key={status} action={setStatusFromForm}>
                    <input type="hidden" name="locale" value={locale} />
                    <input
                      type="hidden"
                      name="appointmentId"
                      value={appointment.id}
                    />
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${label}: ${appointment.patientName}`}
                      title={label}
                    >
                      <Icon aria-hidden />
                    </Button>
                  </form>
                ))}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
