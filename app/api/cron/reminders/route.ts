import { cronAuthorized } from "@/lib/cron-auth";
import { runReminders } from "@/lib/reminders/run";
import { siteUrl } from "@/lib/site-url";

/**
 * Sends the appointment reminders that are due. Vercel calls this every
 * 15 minutes (see `schedules` in vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`; any other caller gets 401.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runReminders({ origin: await siteUrl() });
  return Response.json(result);
}
