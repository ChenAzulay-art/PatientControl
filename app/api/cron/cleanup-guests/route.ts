import { cronAuthorized } from "@/lib/cron-auth";
import { cleanupGuests } from "@/lib/dal/guest";

/**
 * Deletes guest ("Try it as a guest") clinics whose time is up. Vercel calls
 * this every hour (see `schedules` in vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`; any other caller gets 401.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await cleanupGuests());
}
