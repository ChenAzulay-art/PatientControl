import { createHash, timingSafeEqual } from "node:crypto";

/**
 * True when a scheduled-job request carries `Authorization: Bearer
 * <CRON_SECRET>`, as Vercel sends it. No secret configured means no access.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  // Compare digests so the check takes the same time whatever the input.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
