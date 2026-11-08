import { CalendarDays, ClipboardList, Users } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getDictionary();

  const features = [
    {
      icon: Users,
      title: t.home.featurePatientsTitle,
      body: t.home.featurePatientsBody,
    },
    {
      icon: CalendarDays,
      title: t.home.featureScheduleTitle,
      body: t.home.featureScheduleBody,
    },
    {
      icon: ClipboardList,
      title: t.home.featureNotesTitle,
      body: t.home.featureNotesBody,
    },
  ];

  return (
    <>
      <SiteHeader>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/login`}>{t.home.logIn}</Link>
        </Button>
      </SiteHeader>
      <main className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t.home.title}
          </h1>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            {t.home.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/${locale}/signup`}>{t.home.getStarted}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/${locale}/login`}>{t.home.logIn}</Link>
            </Button>
          </div>
        </section>
        <section className="mt-16 grid gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-3 font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
