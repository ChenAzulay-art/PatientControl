import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarPlus,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPatientAppointments } from "@/lib/dal/appointments";
import { getPatient } from "@/lib/dal/patients";
import { requireClinic } from "@/lib/dal/session";
import { ageOn, formatDate, formatDateTime, languageNames } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { formatPhone } from "@/lib/validation/phone";
import { AppointmentList } from "../../calendar/appointment-list";
import { setArchived } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  // The patient's name stays out of the tab title, which can show up in
  // browser history and screen sharing.
  return { title: (await getDictionary()).patients.title };
}

export default async function PatientPage({
  params,
}: PageProps<"/[locale]/patients/[id]">) {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      }
    >
      <PatientCard params={params} />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2">{children}</dd>
    </div>
  );
}

async function PatientCard({
  params,
}: {
  params: PageProps<"/[locale]/patients/[id]">["params"];
}) {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);
  const { id } = await params;

  const patient = await getPatient(ctx, id);
  if (!patient) notFound();
  const appointments = await listPatientAppointments(ctx, patient.id);

  const c = t.patients.card;
  const none = <span className="text-muted-foreground">{c.none}</span>;
  const archived = patient.archivedAt !== null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${locale}/patients`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {c.back}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{patient.fullName}</h1>
          <div className="mt-2 flex flex-wrap gap-1">
            {patient.treatmentTypes.map((type) => (
              <Badge key={type.id} variant="secondary">
                {type.name}
              </Badge>
            ))}
            {archived ? (
              <Badge variant="outline">{t.patients.archivedBadge}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}/patients/${patient.id}/edit`}>
              <Pencil aria-hidden />
              {c.edit}
            </Link>
          </Button>
          <form action={setArchived}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="patientId" value={patient.id} />
            <input
              type="hidden"
              name="archived"
              value={archived ? "false" : "true"}
            />
            <Button type="submit" variant="ghost">
              {archived ? (
                <ArchiveRestore aria-hidden />
              ) : (
                <Archive aria-hidden />
              )}
              {archived ? c.restore : c.archive}
            </Button>
          </form>
        </div>
      </div>

      {archived ? (
        <Alert>
          <Archive aria-hidden />
          <AlertDescription>{c.archivedNotice}</AlertDescription>
        </Alert>
      ) : null}

      {patient.importantNotes ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>{c.importantNotes}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {patient.importantNotes}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{c.personal}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label={c.phone}>
                <a
                  href={`tel:${patient.phone}`}
                  dir="ltr"
                  className="underline-offset-4 hover:underline"
                >
                  {formatPhone(patient.phone)}
                </a>
              </Row>
              <Row label={c.email}>
                {patient.email ? (
                  <a
                    href={`mailto:${patient.email}`}
                    dir="ltr"
                    className="break-all underline-offset-4 hover:underline"
                  >
                    {patient.email}
                  </a>
                ) : (
                  none
                )}
              </Row>
              <Row label={c.dateOfBirth}>
                {patient.dateOfBirth ? (
                  <>
                    {formatDate(locale, patient.dateOfBirth)}{" "}
                    <span className="text-muted-foreground">
                      (
                      {format(c.age, {
                        age: String(ageOn(patient.dateOfBirth)),
                      })}
                      )
                    </span>
                  </>
                ) : (
                  none
                )}
              </Row>
              <Row label={c.nationalId}>
                {patient.nationalId ? (
                  <span dir="ltr">{patient.nationalId}</span>
                ) : (
                  none
                )}
              </Row>
              <Row label={c.preferredLanguage}>
                {languageNames[patient.preferredLocale]}
              </Row>
              <Row label={c.reminders}>
                {patient.reminderConsent ? c.remindersOn : c.remindersOff}
              </Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{c.treatment}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label={c.treatmentTypes}>
                {patient.treatmentTypes.length > 0
                  ? patient.treatmentTypes.map((type) => type.name).join(", ")
                  : none}
              </Row>
              <Row label={c.medicalBackground}>
                {patient.medicalBackground ? (
                  <span className="whitespace-pre-line">
                    {patient.medicalBackground}
                  </span>
                ) : (
                  none
                )}
              </Row>
              <Row label={c.importantNotes}>
                {patient.importantNotes ? (
                  <span className="whitespace-pre-line">
                    {patient.importantNotes}
                  </span>
                ) : (
                  none
                )}
              </Row>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{c.appointments}</CardTitle>
          {archived ? null : (
            <Button asChild size="sm">
              <Link href={`/${locale}/calendar?patient=${patient.id}`}>
                <CalendarPlus aria-hidden />
                {c.newAppointment}
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {c.upcoming}
            </h3>
            {appointments.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.noUpcoming}</p>
            ) : (
              <AppointmentList
                locale={locale}
                t={t.appointment}
                timezone={ctx.clinic.timezone}
                appointments={appointments.upcoming}
                show="date"
                returnTo={`/${locale}/patients/${patient.id}`}
              />
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {c.past}
            </h3>
            {appointments.past.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.noPast}</p>
            ) : (
              <AppointmentList
                locale={locale}
                t={t.appointment}
                timezone={ctx.clinic.timezone}
                appointments={appointments.past}
                show="date"
                returnTo={`/${locale}/patients/${patient.id}`}
                quickActions
              />
            )}
          </section>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {format(c.updated, {
          date: formatDateTime(locale, patient.updatedAt, ctx.clinic.timezone),
        })}
      </p>
    </div>
  );
}
