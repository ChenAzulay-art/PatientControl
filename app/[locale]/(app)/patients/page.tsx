import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { listPatients } from "@/lib/dal/patients";
import { requireClinic } from "@/lib/dal/session";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { PatientList } from "./patient-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).patients.title };
}

export default async function PatientsPage({
  searchParams,
}: PageProps<"/[locale]/patients">) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.patients.title}</h1>
        <Button asChild>
          <Link href={`/${locale}/patients/new`}>
            <Plus aria-hidden />
            {t.patients.new}
          </Link>
        </Button>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <Patients searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Patients({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/patients">["searchParams"];
}) {
  const locale = await getLocale();
  const t = await getDictionary();
  const ctx = await requireClinic(locale);

  // Only the archive switch lives in the URL; search text never does.
  const archived = (await searchParams).archived === "1";
  const initial = await listPatients(ctx, { archived });

  return (
    <>
      <div>
        <Button asChild variant="link" className="px-0">
          <Link href={`/${locale}/patients${archived ? "" : "?archived=1"}`}>
            {archived ? t.patients.showActive : t.patients.showArchived}
          </Link>
        </Button>
      </div>
      <PatientList
        key={String(archived)}
        locale={locale}
        t={t.patients}
        archived={archived}
        initial={initial}
      />
    </>
  );
}
