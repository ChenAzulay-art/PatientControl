import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireClinic } from "@/lib/dal/session";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dashboard.title };
}

export default async function DashboardPage() {
  const t = await getDictionary();
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const locale = await getLocale();
  const t = await getDictionary();
  const { user, clinic } = await requireClinic(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {format(t.dashboard.greeting, { name: user.name })}
        </h1>
        <p className="mt-1 text-muted-foreground">{clinic.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.emptyTitle}</CardTitle>
          <CardDescription>{t.dashboard.emptyBody}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
