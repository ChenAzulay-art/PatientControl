import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { getClinicForSecureUser } from "@/lib/dal/session";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).onboarding.title };
}

export default async function OnboardingPage() {
  const t = await getDictionary();

  return (
    <AuthCard title={t.onboarding.title} description={t.onboarding.description}>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <OnboardingGate />
      </Suspense>
    </AuthCard>
  );
}

async function OnboardingGate() {
  const locale = await getLocale();
  const t = await getDictionary();
  const { clinic } = await getClinicForSecureUser(locale);
  if (clinic) redirect(`/${locale}/dashboard`);
  return <OnboardingForm locale={locale} t={t} />;
}
