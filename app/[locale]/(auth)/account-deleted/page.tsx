import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).deleteAccount.done.title };
}

export default async function AccountDeletedPage() {
  const locale = await getLocale();
  const t = (await getDictionary()).deleteAccount.done;
  return (
    <AuthCard title={t.title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t.body}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}`}>{t.home}</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
