import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/** Shown when a page calls notFound(), e.g. an unknown patient or booking page. */
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t.common.notFoundTitle}</h1>
      <p className="text-muted-foreground">{t.common.notFoundBody}</p>
      <Button asChild variant="outline">
        <Link href={`/${locale}`}>{t.common.notFoundHome}</Link>
      </Button>
    </main>
  );
}
