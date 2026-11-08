import { ShieldCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getWorkingHours,
  listAvailabilityExceptions,
} from "@/lib/dal/availability";
import { getBookingSettings } from "@/lib/dal/booking-settings";
import {
  getReminderSettings,
  listRecentReminders,
  type ReminderLogEntry,
} from "@/lib/dal/reminders";
import { requireClinic } from "@/lib/dal/session";
import { listTreatmentTypes } from "@/lib/dal/treatment-types";
import { formatDate, formatDateTime, weekdayNames } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import {
  type Dictionary,
  getDictionary,
  getLocale,
} from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { todayIn } from "@/lib/scheduling/time";
import { siteUrl } from "@/lib/site-url";
import { removeException } from "./actions";
import { BookingSettingsForm } from "./booking-settings-form";
import { ExceptionForm } from "./exception-form";
import { ReminderSettingsForm } from "./reminder-settings-form";
import { TreatmentTypeForm } from "./treatment-type-form";
import { TreatmentTypeList } from "./treatment-type-list";
import { WorkingHoursForm } from "./working-hours-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title };
}

export default async function SettingsPage() {
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <SettingsDetails />
      </Suspense>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2">{children}</dd>
    </div>
  );
}

async function SettingsDetails() {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);
  const { user, clinic } = ctx;
  const today = todayIn(clinic.timezone);
  const [
    treatmentTypes,
    hours,
    exceptions,
    booking,
    origin,
    reminderSettings,
    reminderLog,
  ] = await Promise.all([
    listTreatmentTypes(ctx, { includeInactive: true }),
    getWorkingHours(ctx),
    listAvailabilityExceptions(ctx, { from: today }),
    getBookingSettings(ctx),
    siteUrl(),
    getReminderSettings(ctx),
    listRecentReminders(ctx),
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.clinic}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label={t.settings.clinicName}>{clinic.name}</Row>
            <Row label={t.settings.bookingAddress}>
              <span dir="ltr">{clinic.slug}</span>
            </Row>
            <Row label={t.settings.timezone}>
              <span dir="ltr">{clinic.timezone}</span>
            </Row>
          </dl>
        </CardContent>
      </Card>

      <Card id="treatment-types" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>{t.treatmentTypes.title}</CardTitle>
          <CardDescription>{t.treatmentTypes.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <TreatmentTypeList
            locale={locale}
            t={t.treatmentTypes}
            minutesLabel={t.appointment.minutes}
            items={treatmentTypes}
          />
          <TreatmentTypeForm locale={locale} t={t.treatmentTypes} />
        </CardContent>
      </Card>

      <Card id="online-booking" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>{t.onlineBooking.title}</CardTitle>
          <CardDescription>{t.onlineBooking.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <BookingSettingsForm
            locale={locale}
            t={t.onlineBooking}
            settings={booking}
            bookingUrl={`${origin}/${locale}/book/${clinic.slug}`}
          />
        </CardContent>
      </Card>

      <Card id="reminders" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>{t.reminders.title}</CardTitle>
          <CardDescription>{t.reminders.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ReminderSettingsForm
            locale={locale}
            t={t.reminders}
            settings={reminderSettings}
          />
          <ReminderLog
            locale={locale}
            t={t.reminders}
            timezone={clinic.timezone}
            entries={reminderLog}
          />
        </CardContent>
      </Card>

      <Card id="working-hours" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>{t.workingHours.title}</CardTitle>
          <CardDescription>{t.workingHours.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkingHoursForm
            locale={locale}
            t={t.workingHours}
            weekdayNames={weekdayNames(locale)}
            initial={hours}
          />
        </CardContent>
      </Card>

      <Card id="exceptions" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>{t.exceptions.title}</CardTitle>
          <CardDescription>{t.exceptions.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.exceptions.none}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {exceptions.map((exception) => (
                <li
                  key={exception.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span>
                    <span className="font-medium">
                      {formatDate(locale, exception.date)}
                    </span>
                    <span className="ms-2 text-muted-foreground" dir="auto">
                      {exception.range
                        ? `${exception.range.start}–${exception.range.end}`
                        : t.exceptions.closedLabel}
                    </span>
                  </span>
                  <form action={removeException}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={exception.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      <X aria-hidden />
                      {t.exceptions.remove}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <ExceptionForm
            locale={locale}
            t={t.exceptions}
            hoursT={t.workingHours}
            minDate={today}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.account}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label={t.auth.name}>{user.name}</Row>
            <Row label={t.settings.email}>
              <span dir="ltr">{user.email}</span>
            </Row>
            <Row label={t.settings.twoFactor}>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                {t.settings.twoFactorOn}
              </span>
            </Row>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

function reminderStatus(
  entry: ReminderLogEntry,
  t: Dictionary["reminders"]["status"],
): { label: string; variant: "secondary" | "outline" | "destructive" } {
  if (entry.errorCode === "not_due") {
    return { label: t.notDue, variant: "outline" };
  }
  switch (entry.status) {
    case "sent":
      return { label: t.sent, variant: "secondary" };
    case "failed":
      return { label: t.failed, variant: "destructive" };
    case "retry":
      return { label: t.retry, variant: "outline" };
    default:
      return { label: t.sending, variant: "outline" };
  }
}

function ReminderLog({
  locale,
  t,
  timezone,
  entries,
}: {
  locale: Locale;
  t: Dictionary["reminders"];
  timezone: string;
  entries: ReminderLogEntry[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{t.log}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.none}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {entries.map((entry) => {
            const status = reminderStatus(entry, t.status);
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <Link
                    href={`/${locale}/patients/${entry.patientId}`}
                    className="font-medium hover:underline"
                  >
                    {entry.patientName}
                  </Link>
                  <span className="ms-2 text-muted-foreground">
                    {format(t.appointmentAt, {
                      when: formatDateTime(
                        locale,
                        new Date(entry.appointmentStartsAt),
                        timezone,
                      ),
                    })}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {entry.attempts > 1 ? (
                    <span className="text-xs text-muted-foreground">
                      {format(t.attempts, { n: String(entry.attempts) })}
                    </span>
                  ) : null}
                  <Badge variant={status.variant}>{status.label}</Badge>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
