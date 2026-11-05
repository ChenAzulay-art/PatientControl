import { LogOut } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import { signOut } from "./actions";

/**
 * The signed-in area's frame. It doesn't read the session itself (that would
 * hold up every page); each page checks access through lib/dal/session.
 */
export default async function AppLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <>
      <SiteHeader href={`/${locale}/dashboard`}>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost" size="sm">
            <LogOut aria-hidden className="rtl:-scale-x-100" />
            <span className="max-sm:sr-only">{t.common.signOut}</span>
          </Button>
        </form>
      </SiteHeader>
      <nav aria-label={t.common.appName} className="border-b">
        <div className="mx-auto flex max-w-5xl gap-1 px-4 py-2 text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/dashboard`}>{t.nav.dashboard}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/patients`}>{t.nav.patients}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/settings`}>{t.nav.settings}</Link>
          </Button>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
