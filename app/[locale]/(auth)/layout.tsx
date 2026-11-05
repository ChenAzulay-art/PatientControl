import { SiteHeader } from "@/components/site-header";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:py-16">
        {children}
      </main>
    </>
  );
}
