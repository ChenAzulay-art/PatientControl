import { ArrowLeft, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPatient } from "@/lib/dal/patients";
import {
  getSessionForEditing,
  SUMMARY_MAX_LENGTH,
} from "@/lib/dal/session-notes";
import { requireClinic } from "@/lib/dal/session";
import { formatDayShort, formatTime } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { StatusBadge } from "../../../../calendar/appointment-dialog";
import { SummaryEditor } from "./summary-editor";
import { VersionHistory } from "./version-history";

export async function generateMetadata(): Promise<Metadata> {
  // No patient name in the tab title.
  return { title: (await getDictionary()).summary.title };
}

type Params =
  PageProps<"/[locale]/patients/[id]/sessions/[appointmentId]">["params"];

export default async function SessionSummaryPage({
  params,
}: PageProps<"/[locale]/patients/[id]/sessions/[appointmentId]">) {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      }
    >
      <SessionSummary params={params} />
    </Suspense>
  );
}

async function SessionSummary({ params }: { params: Params }) {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);
  const { id, appointmentId } = await params;

  const session = await getSessionForEditing(ctx, appointmentId);
  // The URL's patient must be the appointment's patient.
  if (!session || session.appointment.patientId !== id) notFound();
  const patient = await getPatient(ctx, id);
  if (!patient) notFound();

  const { appointment } = session;
  const tz = ctx.clinic.timezone;
  const start = new Date(appointment.startsAt);
  const end = new Date(appointment.endsAt);
  const allowed =
    appointment.status !== "cancelled" && appointment.status !== "no_show";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/${locale}/patients/${patient.id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.summary.backToPatient}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{t.summary.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span className="font-medium text-foreground">
            {patient.fullName}
          </span>
          <span aria-hidden>·</span>
          <span>{formatDayShort(locale, start, tz)}</span>
          <span dir="ltr">
            {formatTime(locale, start, tz)}–{formatTime(locale, end, tz)}
          </span>
          {appointment.treatmentName ? (
            <>
              <span aria-hidden>·</span>
              <span>{appointment.treatmentName}</span>
            </>
          ) : null}
          <StatusBadge status={appointment.status} t={t.appointment} />
        </p>
      </div>

      {patient.importantNotes ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>{t.patients.card.importantNotes}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {patient.importantNotes}
          </AlertDescription>
        </Alert>
      ) : null}

      {allowed || session.note ? (
        <SummaryEditor
          locale={locale}
          t={t.summary}
          appointmentId={appointment.id}
          timezone={tz}
          initialNote={session.note}
          maxLength={SUMMARY_MAX_LENGTH}
        />
      ) : (
        <Alert>
          <AlertDescription>{t.summary.errors.notAllowed}</AlertDescription>
        </Alert>
      )}

      {session.versions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.summary.versions}</CardTitle>
            <CardDescription>{t.summary.versionsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <VersionHistory
              locale={locale}
              t={t.summary}
              timezone={tz}
              versions={session.versions}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
