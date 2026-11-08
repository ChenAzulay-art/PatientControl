import type { Metadata } from "next";
import { Suspense } from "react";
import { getWorkingHours } from "@/lib/dal/availability";
import { getPatientName } from "@/lib/dal/patients";
import { requireClinic } from "@/lib/dal/session";
import { listTreatmentTypes } from "@/lib/dal/treatment-types";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { CalendarView } from "./calendar-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).calendar.title };
}

export default async function CalendarPage({
  searchParams,
}: PageProps<"/[locale]/calendar">) {
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.calendar.title}</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <Calendar searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Calendar({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/calendar">["searchParams"];
}) {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);

  // ?patient=<id> (from the patient card) opens the booking dialog for that patient.
  // Only the id is in the URL, never the name.
  const { patient } = await searchParams;
  const [treatmentTypes, workingHours, presetPatient] = await Promise.all([
    listTreatmentTypes(ctx),
    getWorkingHours(ctx),
    typeof patient === "string" ? getPatientName(ctx, patient) : null,
  ]);

  return (
    <CalendarView
      locale={locale}
      t={{ calendar: t.calendar, appointment: t.appointment }}
      timezone={ctx.clinic.timezone}
      treatmentTypes={treatmentTypes}
      workingHours={workingHours}
      presetPatient={presetPatient}
    />
  );
}
