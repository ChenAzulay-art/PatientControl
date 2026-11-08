import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { TermsEn, TermsHe } from "./content";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).legal.terms };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <LegalPage locale={locale} t={t.legal} title={t.legal.terms}>
      {locale === "he" ? <TermsHe /> : <TermsEn />}
    </LegalPage>
  );
}
