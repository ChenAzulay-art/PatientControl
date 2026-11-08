import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { LEGAL } from "@/lib/legal";

/** The frame of the privacy policy and terms pages. */
export function LegalPage({
  locale,
  t,
  title,
  children,
}: {
  locale: Locale;
  t: Dictionary["legal"];
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6 text-sm leading-relaxed sm:text-base">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">
          {format(t.lastUpdated, {
            date: formatDate(locale, LEGAL.lastUpdated),
          })}
        </p>
      </header>
      {LEGAL.reviewed ? null : (
        <Alert>
          <TriangleAlert aria-hidden />
          <AlertDescription>{t.draft}</AlertDescription>
        </Alert>
      )}
      {children}
    </article>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 ps-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
