import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { clinicSettings, member, organization } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";

/** The signed-in practitioner, as safe to pass to the UI. */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  /** A visitor from "Try it as a guest", with a temporary demo clinic. */
  isGuest: boolean;
};

export type CurrentClinic = {
  id: string;
  name: string;
  slug: string;
  role: string;
  timezone: string;
  /** A temporary guest clinic: no emails, size limits, deleted within hours. */
  isDemo: boolean;
};

/** How long a guest can use the app before they need to start again. */
export const GUEST_SESSION_MINUTES = 120;

/** Reads and validates the session once per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

function toCurrentUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    isGuest: Boolean(user.isAnonymous),
  } satisfies CurrentUser;
}

/** A guest whose time is up; the cleanup job deletes their clinic soon after. */
export function guestExpired(user: SessionUser, now = new Date()): boolean {
  return (
    Boolean(user.isAnonymous) &&
    now.getTime() - new Date(user.createdAt).getTime() >
      GUEST_SESSION_MINUTES * 60_000
  );
}

/** Any signed-in user, even before two-step verification is set up. */
export async function requireUser(locale: Locale): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (guestExpired(session.user)) redirect(`/${locale}?guest=expired`);
  return toCurrentUser(session.user);
}

/**
 * A signed-in user who has two-step verification turned on. Guests skip it:
 * they have no password to protect, and can only reach their own demo clinic.
 */
export async function requireSecureUser(locale: Locale): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!user.twoFactorEnabled && !user.isGuest) {
    redirect(`/${locale}/setup-2fa`);
  }
  return user;
}

const findClinicForUser = cache(
  async (userId: string, activeOrganizationId: string | null | undefined) => {
    const rows = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: member.role,
        timezone: clinicSettings.timezone,
        isDemo: clinicSettings.isDemo,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .leftJoin(clinicSettings, eq(clinicSettings.clinicId, organization.id))
      .where(
        activeOrganizationId
          ? and(
              eq(member.userId, userId),
              eq(member.organizationId, activeOrganizationId),
            )
          : eq(member.userId, userId),
      )
      .orderBy(asc(member.createdAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      timezone: row.timezone ?? "Asia/Jerusalem",
      isDemo: Boolean(row.isDemo),
    } satisfies CurrentClinic;
  },
);

/** The signed-in user's clinic, or null if they haven't created one yet. */
export async function getClinicForSecureUser(
  locale: Locale,
): Promise<{ user: CurrentUser; clinic: CurrentClinic | null }> {
  const user = await requireSecureUser(locale);
  const session = await getSession();
  const active = session?.session.activeOrganizationId;
  const clinic =
    (await findClinicForUser(user.id, active)) ??
    (await findClinicForUser(user.id, null));
  return { user, clinic };
}

/**
 * Like `requireClinic`, but returns null instead of redirecting, for route
 * handlers that answer with a status code (e.g. the data export).
 */
export async function findClinicContext(): Promise<{
  user: CurrentUser;
  clinic: CurrentClinic;
} | null> {
  const session = await getSession();
  if (!session || guestExpired(session.user)) return null;
  const user = toCurrentUser(session.user);
  if (!user.twoFactorEnabled && !user.isGuest) return null;
  const active = session.session.activeOrganizationId;
  const clinic =
    (await findClinicForUser(user.id, active)) ??
    (await findClinicForUser(user.id, null));
  return clinic ? { user, clinic } : null;
}

/**
 * The entry point for every clinic page and action: a signed-in user with
 * two-step verification and a clinic. All clinic data queries take the
 * returned `clinic.id`, never an id from the request.
 */
export async function requireClinic(
  locale: Locale,
): Promise<{ user: CurrentUser; clinic: CurrentClinic }> {
  const { user, clinic } = await getClinicForSecureUser(locale);
  if (!clinic) redirect(`/${locale}/onboarding`);
  return { user, clinic };
}
