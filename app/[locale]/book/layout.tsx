import { Suspense } from "react";
import {
  LanguageSwitcher,
  LanguageSwitcherFallback,
} from "@/components/language-switcher";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";

/** Public pages for patients: no app navigation, just the language switch. */
export default async function BookLayout({
  children,
}: LayoutProps<"/[locale]/book">) {
  const locale = await getLocale();
  const t = await getDictionary();
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-end px-4">
          <Suspense
            fallback={
              <LanguageSwitcherFallback
                current={locale}
                label={t.common.otherLanguage}
              />
            }
          >
            <LanguageSwitcher current={locale} label={t.common.otherLanguage} />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        {children}
      </main>
    </>
  );
}
