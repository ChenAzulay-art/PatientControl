import "server-only";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import type en from "@/messages/en.json";
import { isLocale, type Locale } from "./config";

export type Dictionary = typeof en;

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  he: () => import("@/messages/he.json").then((m) => m.default),
  en: () => import("@/messages/en.json").then((m) => m.default),
};

/** Dictionary for an explicit locale (Server Actions, emails, route handlers). */
export function getDictionaryFor(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}

/** Current route's locale, read from the `[locale]` root segment. Server Components only. */
export async function getLocale(): Promise<Locale> {
  const value = await rootLocale();
  if (!isLocale(value)) notFound();
  return value;
}

/** Dictionary for the current route. Server Components only. */
export async function getDictionary(): Promise<Dictionary> {
  return getDictionaryFor(await getLocale());
}
