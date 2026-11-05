import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { requireUser } from "@/lib/dal/session";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { SetupTwoFactorForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.setup2fa.title };
}

export default async function SetupTwoFactorPage() {
  const t = await getDictionary();

  return (
    <AuthCard
      title={t.auth.setup2fa.title}
      description={t.auth.setup2fa.description}
    >
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <SetupGate />
      </Suspense>
    </AuthCard>
  );
}

/** Reads the session, so it streams in behind the Suspense boundary. */
async function SetupGate() {
  const locale = await getLocale();
  const t = await getDictionary();
  const user = await requireUser(locale);
  if (user.twoFactorEnabled) redirect(`/${locale}/dashboard`);
  return <SetupTwoFactorForm locale={locale} t={t.auth} />;
}
