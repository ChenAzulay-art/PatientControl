import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.login.title };
}

export default async function LoginPage() {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <AuthCard
      title={t.auth.login.title}
      description={t.auth.login.description}
      footer={
        <>
          {t.auth.login.noAccount}
          <Link
            href={`/${locale}/signup`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t.auth.login.signUpLink}
          </Link>
        </>
      }
    >
      <LoginForm locale={locale} t={t.auth} />
    </AuthCard>
  );
}
