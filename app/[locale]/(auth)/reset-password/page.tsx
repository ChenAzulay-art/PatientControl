import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { ResetPasswordForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.reset.title };
}

export default async function ResetPasswordPage() {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <AuthCard title={t.auth.reset.title} description={t.auth.reset.description}>
      {/* The token comes from the URL, which is only known at request time. */}
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <ResetPasswordForm locale={locale} t={t.auth} />
      </Suspense>
    </AuthCard>
  );
}
