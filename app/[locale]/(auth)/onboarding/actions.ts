"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clinicSettings } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getClinicForSecureUser } from "@/lib/dal/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { createClinicSchema } from "@/lib/validation/auth";

export type CreateClinicState = {
  error?: "nameRequired" | "slugInvalid" | "slugTaken" | "generic";
  values?: { name: string; slug: string };
};

export async function createClinic(
  _prev: CreateClinicState,
  formData: FormData,
): Promise<CreateClinicState> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  // Re-check the session here: never trust that the page did it.
  const { user, clinic } = await getClinicForSecureUser(locale);
  if (clinic) redirect(`/${locale}/dashboard`);

  const values = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
  };
  const parsed = createClinicSchema.safeParse(values);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "name" ? "nameRequired" : "slugInvalid", values };
  }

  try {
    const organization = await auth.api.createOrganization({
      body: { name: parsed.data.name, slug: parsed.data.slug },
      headers: await headers(),
    });
    if (!organization) return { error: "generic", values };

    await db
      .insert(clinicSettings)
      .values({ clinicId: organization.id, defaultLocale: locale })
      .onConflictDoNothing();
    await recordAudit({
      actorId: user.id,
      clinicId: organization.id,
      action: "clinic.created",
      entity: "clinic",
      entityId: organization.id,
    });
  } catch (error) {
    if (
      error instanceof APIError &&
      error.body?.code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
    ) {
      return { error: "slugTaken", values };
    }
    if (
      error instanceof APIError &&
      error.body?.code === "ORGANIZATION_ALREADY_EXISTS"
    ) {
      return { error: "slugTaken", values };
    }
    throw error;
  }

  redirect(`/${locale}/dashboard`);
}
