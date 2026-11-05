import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.verifyEmail.title };
}

export default async function VerifyEmailPage() {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <AuthCard
      title={t.auth.verifyEmail.title}
      description={t.auth.verifyEmail.description}
      footer={
        <Link
          href={`/${locale}/login`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t.auth.signup.logInLink}
        </Link>
      }
    >
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <MailCheck
          className="mt-0.5 size-5 shrink-0 text-primary"
          aria-hidden
        />
        <p>{t.auth.verifyEmail.checkSpam}</p>
      </div>
    </AuthCard>
  );
}
