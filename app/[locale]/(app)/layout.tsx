import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/guest/sign-out-button";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/dal/session";
import type { Locale } from "@/lib/i18n/config";
import {
  type Dictionary,
  getDictionary,
  getLocale,
} from "@/lib/i18n/dictionaries";
import { signOut } from "./actions";

/** Sign out, or "Exit guest mode" (with a warning) for guests. */
async function AccountButton({ locale, t }: { locale: Locale; t: Dictionary }) {
  const guest = Boolean((await getSession())?.user.isAnonymous);
  return (
    <SignOutButton
      action={signOut}
      locale={locale}
      label={guest ? t.guest.exit : t.common.signOut}
      confirmText={guest ? t.guest.exitConfirm : undefined}
    />
  );
}

/** A reminder on every page that guest data is temporary and not for real patients. */
async function GuestBanner({ t }: { t: Dictionary["guest"] }) {
  if (!(await getSession())?.user.isAnonymous) return null;
  return (
    <div
      role="note"
      className="border-b bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50"
    >
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {t.banner}
      </p>
    </div>
  );
}

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
        <Suspense
          fallback={
            <SignOutButton
              action={signOut}
              locale={locale}
              label={t.common.signOut}
            />
          }
        >
          <AccountButton locale={locale} t={t} />
        </Suspense>
      </SiteHeader>
      <Suspense fallback={null}>
        <GuestBanner t={t.guest} />
      </Suspense>
      <nav aria-label={t.common.appName} className="border-b">
        <div className="mx-auto flex max-w-5xl gap-1 px-4 py-2 text-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/dashboard`}>{t.nav.dashboard}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/patients`}>{t.nav.patients}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/calendar`}>{t.nav.calendar}</Link>
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
