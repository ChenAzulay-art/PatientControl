import { SiteHeader } from "@/components/site-header";

export default function LegalLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        {children}
      </main>
    </>
  );
}
