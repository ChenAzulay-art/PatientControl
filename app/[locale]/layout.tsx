import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { DirectionProvider } from "@/components/ui/direction";
import { localeDirection, locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/dictionaries";
import "../globals.css";

// Rubik covers both Hebrew and Latin, so mixed text looks consistent.
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-sans" });

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: { default: t.common.appName, template: `%s · ${t.common.appName}` },
    description: t.common.tagline,
  };
}

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dir = localeDirection[locale];

  return (
    <html lang={locale} dir={dir} className={rubik.variable}>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <DirectionProvider dir={dir}>
          {children}
          <div className="mt-auto">
            <SiteFooter />
          </div>
        </DirectionProvider>
      </body>
    </html>
  );
}
