import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/** Links to the privacy policy and terms, on every page. */
export async function SiteFooter() {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <footer className="border-t">
      <nav
        aria-label={t.legal.terms}
        className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground"
      >
        <Link
          href={`/${locale}/privacy`}
          className="hover:text-foreground hover:underline"
        >
          {t.legal.privacy}
        </Link>
        <Link
          href={`/${locale}/terms`}
          className="hover:text-foreground hover:underline"
        >
          {t.legal.terms}
        </Link>
      </nav>
    </footer>
  );
}
