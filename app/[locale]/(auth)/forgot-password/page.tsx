import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { ForgotPasswordForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.forgot.title };
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <AuthCard
      title={t.auth.forgot.title}
      description={t.auth.forgot.description}
      footer={
        <Link
          href={`/${locale}/login`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t.auth.signup.logInLink}
        </Link>
      }
    >
      <ForgotPasswordForm locale={locale} t={t.auth} />
    </AuthCard>
  );
}
