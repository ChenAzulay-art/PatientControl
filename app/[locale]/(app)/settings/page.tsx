import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClinic } from "@/lib/dal/session";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title };
}

export default async function SettingsPage() {
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        }
      >
        <SettingsDetails />
      </Suspense>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2">{children}</dd>
    </div>
  );
}

async function SettingsDetails() {
  const locale = await getLocale();
  const t = await getDictionary();
  const { user, clinic } = await requireClinic(locale);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.clinic}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label={t.settings.clinicName}>{clinic.name}</Row>
            <Row label={t.settings.bookingAddress}>
              <span dir="ltr">{clinic.slug}</span>
            </Row>
            <Row label={t.settings.timezone}>
              <span dir="ltr">{clinic.timezone}</span>
            </Row>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.account}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label={t.auth.name}>{user.name}</Row>
            <Row label={t.settings.email}>
              <span dir="ltr">{user.email}</span>
            </Row>
            <Row label={t.settings.twoFactor}>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                {t.settings.twoFactorOn}
              </span>
            </Row>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
