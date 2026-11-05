import type { Metadata } from "next";
import { Suspense } from "react";
import { listTreatmentTypes } from "@/lib/dal/treatment-types";
import { requireClinic } from "@/lib/dal/session";
import { languageNames } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { PatientForm } from "../patient-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).patients.form.newTitle };
}

export default async function NewPatientPage() {
  const t = await getDictionary();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.patients.form.newTitle}</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <NewPatientForm />
      </Suspense>
    </div>
  );
}

async function NewPatientForm() {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);
  const treatmentTypes = await listTreatmentTypes(ctx);

  return (
    <PatientForm
      locale={locale}
      t={t.patients}
      languageNames={languageNames}
      treatmentTypes={treatmentTypes}
      cancelHref={`/${locale}/patients`}
      initial={{
        fullName: "",
        phone: "",
        email: "",
        dateOfBirth: "",
        nationalId: "",
        medicalBackground: "",
        importantNotes: "",
        treatmentTypeIds: [],
        preferredLocale: locale,
        reminderConsent: false,
      }}
    />
  );
}
