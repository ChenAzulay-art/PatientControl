import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPatient } from "@/lib/dal/patients";
import { listTreatmentTypes } from "@/lib/dal/treatment-types";
import { requireClinic } from "@/lib/dal/session";
import { languageNames } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { formatPhone } from "@/lib/validation/phone";
import { PatientForm } from "../../patient-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).patients.form.editTitle };
}

export default async function EditPatientPage({
  params,
}: PageProps<"/[locale]/patients/[id]/edit">) {
  const t = await getDictionary();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.patients.form.editTitle}</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <EditPatientForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditPatientForm({
  params,
}: {
  params: PageProps<"/[locale]/patients/[id]/edit">["params"];
}) {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);
  const { id } = await params;

  const patient = await getPatient(ctx, id);
  if (!patient) notFound();

  // Keep treatment types the patient already has, even if they're now hidden.
  const active = await listTreatmentTypes(ctx);
  const hiddenButAssigned = patient.treatmentTypes.filter(
    (assigned) => !active.some((type) => type.id === assigned.id),
  );

  return (
    <PatientForm
      locale={locale}
      t={t.patients}
      languageNames={languageNames}
      treatmentTypes={[...active, ...hiddenButAssigned]}
      patientId={patient.id}
      cancelHref={`/${locale}/patients/${patient.id}`}
      initial={{
        fullName: patient.fullName,
        phone: formatPhone(patient.phone),
        email: patient.email ?? "",
        dateOfBirth: patient.dateOfBirth ?? "",
        nationalId: patient.nationalId ?? "",
        medicalBackground: patient.medicalBackground ?? "",
        importantNotes: patient.importantNotes ?? "",
        treatmentTypeIds: patient.treatmentTypes.map((type) => type.id),
        preferredLocale: patient.preferredLocale,
        reminderConsent: patient.reminderConsent,
      }}
    />
  );
}
