import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.signup.title };
}

export default async function SignupPage() {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <AuthCard
      title={t.auth.signup.title}
      description={t.auth.signup.description}
      footer={
        <>
          {t.auth.signup.haveAccount}
          <Link
            href={`/${locale}/login`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.auth.signup.logInLink}
          </Link>
        </>
      }
    >
      <SignupForm locale={locale} t={t.auth} />
    </AuthCard>
  );
}
