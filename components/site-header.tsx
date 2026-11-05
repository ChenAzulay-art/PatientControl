import { Stethoscope } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/** Top bar with the app name and language switch; `children` go at the end. */
export async function SiteHeader({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const locale = await getLocale();
  const t = await getDictionary();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link
          href={href ?? `/${locale}`}
          className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap"
        >
          <Stethoscope className="size-5 text-primary" aria-hidden />
          {t.common.appName}
        </Link>
        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher current={locale} label={t.common.otherLanguage} />
          {children}
        </div>
      </div>
    </header>
  );
}
