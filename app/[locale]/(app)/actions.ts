"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { deleteGuestData } from "@/lib/dal/guest";
import { getSession } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

/** Signs out. A guest's demo clinic is deleted with everything in it. */
export async function signOut(formData: FormData) {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await getSession();
  await auth.api.signOut({ headers: await headers() });
  if (session?.user.isAnonymous) {
    await deleteGuestData(session.user.id);
    redirect(`/${locale}?guest=ended`);
  }
  redirect(`/${locale}/login`);
}
