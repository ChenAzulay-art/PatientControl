import { CalendarDays, NotebookPen, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAppointments } from "@/lib/dal/appointments";
import {
  listSessionsMissingSummary,
  summaryStatusFor,
} from "@/lib/dal/session-notes";
import { requireClinic } from "@/lib/dal/session";
import { formatDate, formatDayShort } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { todayIn, zonedDayRange } from "@/lib/scheduling/time";
import { AppointmentList } from "../calendar/appointment-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dashboard.title };
}

export default async function DashboardPage() {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);
  const { user, clinic } = ctx;

  const today = todayIn(clinic.timezone);
  const { start, end } = zonedDayRange(today, clinic.timezone);
  const [appointments, missing] = await Promise.all([
    listAppointments(ctx, { from: start, to: end }),
    listSessionsMissingSummary(ctx),
  ]);
  const summaries = await summaryStatusFor(
    ctx,
    appointments.map((appointment) => appointment.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {format(t.dashboard.greeting, { name: user.name })}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {clinic.name} · {formatDate(locale, today)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.todayTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.dashboard.todayEmpty}
            </p>
          ) : (
            <AppointmentList
              locale={locale}
              t={t.appointment}
              timezone={clinic.timezone}
              appointments={appointments}
              show="patient"
              returnTo={`/${locale}/dashboard`}
              quickActions
              summaries={summaries}
              summaryT={t.patients.card}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/${locale}/calendar`}>
                <CalendarDays aria-hidden />
                {t.dashboard.openCalendar}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/patients/new`}>
                <UserPlus aria-hidden />
                {t.dashboard.addPatient}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.missingTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.dashboard.missingEmpty}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {missing.map((session) => (
                <li key={session.appointmentId}>
                  <Link
                    href={`/${locale}/patients/${session.patientId}/sessions/${session.appointmentId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <NotebookPen
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="font-medium">{session.patientName}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDayShort(
                        locale,
                        new Date(session.startsAt),
                        clinic.timezone,
                      )}
                      {session.treatmentName
                        ? ` · ${session.treatmentName}`
                        : ""}
                    </span>
                    {session.hasDraft ? (
                      <Badge variant="outline">
                        {t.patients.card.draftBadge}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.emptyTitle}</CardTitle>
          <CardDescription>{t.dashboard.emptyBody}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
