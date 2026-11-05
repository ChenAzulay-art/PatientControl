"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isLocale, type Locale } from "@/lib/i18n/config";

/** Links to the same page in the other language. */
export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const pathname = usePathname() ?? `/${current}`;
  const target: Locale = current === "he" ? "en" : "he";
  const [, first, ...rest] = pathname.split("/");
  const href = isLocale(first)
    ? `/${[target, ...rest].join("/")}`
    : `/${target}`;

  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href} hrefLang={target} lang={target}>
        <Languages aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
