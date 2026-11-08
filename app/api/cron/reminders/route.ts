import { createHash, timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders/run";
import { siteUrl } from "@/lib/site-url";

/**
 * Sends the appointment reminders that are due. Vercel calls this every
 * 15 minutes (see `schedules` in vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`; any other caller gets 401.
 */
export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runReminders({ origin: await siteUrl() });
  return Response.json(result);
}

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  // Compare digests so the check takes the same time whatever the input.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
