import { ShieldCheck, X } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
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
import { requireClinic } from "@/lib/dal/session";
import { listTreatmentTypes } from "@/lib/dal/treatment-types";
import { formatDate, weekdayNames } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { todayIn } from "@/lib/scheduling/time";
import { removeException } from "./actions";
import { ExceptionForm } from "./exception-form";
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
  const [treatmentTypes, hours, exceptions] = await Promise.all([
    listTreatmentTypes(ctx, { includeInactive: true }),
    getWorkingHours(ctx),
    listAvailabilityExceptions(ctx, { from: today }),
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
