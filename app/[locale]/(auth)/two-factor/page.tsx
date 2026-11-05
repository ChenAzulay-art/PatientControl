import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { TwoFactorForm } from "./two-factor-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.twoFactor.title };
}

export default async function TwoFactorPage() {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <AuthCard
      title={t.auth.twoFactor.title}
      description={t.auth.twoFactor.description}
    >
      <TwoFactorForm locale={locale} t={t.auth} />
    </AuthCard>
  );
}
