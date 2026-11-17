"use server";

import { checkBotId } from "botid/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createGuestClinic, deleteGuestData } from "@/lib/dal/guest";
import { getSession } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { consumeRateLimit } from "@/lib/rate-limit";

export type GuestState = { error?: "bot" | "tooMany" | "full" };

/** Guest sessions per IP address per hour, and for the whole site per day. */
const PER_ADDRESS = { limit: 5, windowSeconds: 60 * 60 };
const PER_DAY = { limit: 200, windowSeconds: 24 * 60 * 60 };

async function clientKey(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * "Try it as a guest": signs in a throwaway user with a fresh demo clinic
 * (lib/dal/guest.ts) and opens the dashboard. No email or password.
 */
export async function startGuestSession(
  _prev: GuestState,
  formData: FormData,
): Promise<GuestState> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const existing = await getSession();
  // A practitioner who is already signed in just goes to their clinic.
  if (existing && !existing.user.isAnonymous) redirect(`/${locale}/dashboard`);

  // Vercel BotID: blocks automated clicks (always passes in development).
  if ((await checkBotId()).isBot) return { error: "bot" };
  const { limit, windowSeconds } = PER_ADDRESS;
  if (
    !(await consumeRateLimit(
      `guest:${await clientKey()}`,
      limit,
      windowSeconds,
    ))
  ) {
    return { error: "tooMany" };
  }
  if (
    !(await consumeRateLimit("guest:all", PER_DAY.limit, PER_DAY.windowSeconds))
  ) {
    return { error: "full" };
  }

  // A guest who starts again gets a fresh clinic; the old one is deleted.
  if (existing?.user.isAnonymous) {
    await auth.api.signOut({ headers: await headers() });
    await deleteGuestData(existing.user.id);
  }

  const { user } = await auth.api.signInAnonymous({ headers: await headers() });
  try {
    await createGuestClinic(user.id, locale);
  } catch (error) {
    // Don't leave a half-made guest behind.
    await deleteGuestData(user.id);
    throw error;
  }
  redirect(`/${locale}/dashboard`);
}
