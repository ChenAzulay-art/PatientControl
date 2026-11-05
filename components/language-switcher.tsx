"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isLocale, type Locale } from "@/lib/i18n/config";

type Props = { current: Locale; label: string };

function otherLocale(current: Locale): Locale {
  return current === "he" ? "en" : "he";
}

function SwitcherLink({ current, label, href }: Props & { href: string }) {
  const target = otherLocale(current);
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href} hrefLang={target} lang={target}>
        <Languages aria-hidden />
        {label}
      </Link>
    </Button>
  );
}

/**
 * Links to the other language's home page. Shown while the current URL is
 * still loading (see LanguageSwitcher), and works without JavaScript.
 */
export function LanguageSwitcherFallback(props: Props) {
  return <SwitcherLink {...props} href={`/${otherLocale(props.current)}`} />;
}

/**
 * Links to the same page in the other language. Reads the URL, so render it
 * inside <Suspense> with LanguageSwitcherFallback as the fallback.
 */
export function LanguageSwitcher(props: Props) {
  const pathname = usePathname() ?? `/${props.current}`;
  const [, first, ...rest] = pathname.split("/");
  const target = otherLocale(props.current);
  const href = isLocale(first)
    ? `/${[target, ...rest].join("/")}`
    : `/${target}`;
  return <SwitcherLink {...props} href={href} />;
}
