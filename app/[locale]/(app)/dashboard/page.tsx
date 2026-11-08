import { CalendarDays, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAppointments } from "@/lib/dal/appointments";
import { requireClinic } from "@/lib/dal/session";
import { formatDate } from "@/lib/format";
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
  const appointments = await listAppointments(ctx, { from: start, to: end });

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
          <CardTitle>{t.dashboard.emptyTitle}</CardTitle>
          <CardDescription>{t.dashboard.emptyBody}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
