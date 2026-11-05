"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

export async function signOut(formData: FormData) {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  await auth.api.signOut({ headers: await headers() });
  redirect(`/${locale}/login`);
}
