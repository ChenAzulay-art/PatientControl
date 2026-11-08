import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { ClinicContext } from "./context";

export type PasswordCheck = "ok" | "wrong" | "tooMany";

/** Five tries per user per 15 minutes, so a stolen session can't guess the password. */
const ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

/**
 * Asks for the password again before a sensitive step (exporting every
 * patient record, deleting the account), so an unlocked computer or a
 * stolen session isn't enough.
 */
export async function confirmPassword(
  ctx: ClinicContext,
  password: string,
): Promise<PasswordCheck> {
  if (!password || password.length > 128) return "wrong";
  if (
    !(await consumeRateLimit(`reauth:${ctx.user.id}`, ATTEMPTS, WINDOW_SECONDS))
  ) {
    return "tooMany";
  }
  try {
    await auth.api.verifyPassword({
      body: { password },
      headers: await headers(),
    });
    return "ok";
  } catch {
    return "wrong";
  }
}
