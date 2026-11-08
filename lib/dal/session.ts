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
};

export type CurrentClinic = {
  id: string;
  name: string;
  slug: string;
  role: string;
  timezone: string;
};

/** Reads and validates the session once per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

function toCurrentUser(
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>["user"],
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  } satisfies CurrentUser;
}

/** Any signed-in user, even before two-step verification is set up. */
export async function requireUser(locale: Locale): Promise<CurrentUser> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  return toCurrentUser(session.user);
}

/** A signed-in user who has two-step verification turned on. */
export async function requireSecureUser(locale: Locale): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!user.twoFactorEnabled) redirect(`/${locale}/setup-2fa`);
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
  if (!session) return null;
  const user = toCurrentUser(session.user);
  if (!user.twoFactorEnabled) return null;
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
