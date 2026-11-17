import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clinicSettings } from "@/db/schema";

/**
 * Guest clinics ("Try it as a guest") never email anyone: a visitor might
 * type a real person's address into a demo patient card.
 */
export async function isDemoClinic(clinicId: string): Promise<boolean> {
  const [row] = await db
    .select({ isDemo: clinicSettings.isDemo })
    .from(clinicSettings)
    .where(eq(clinicSettings.clinicId, clinicId))
    .limit(1);
  return Boolean(row?.isDemo);
}
