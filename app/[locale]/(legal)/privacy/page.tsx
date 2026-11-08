import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { PrivacyEn, PrivacyHe } from "./content";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).legal.privacy };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <LegalPage locale={locale} t={t.legal} title={t.legal.privacy}>
      {locale === "he" ? <PrivacyHe /> : <PrivacyEn />}
    </LegalPage>
  );
}
