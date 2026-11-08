import "server-only";
import { headers } from "next/headers";

/**
 * The site's public origin, for links in emails. BETTER_AUTH_URL in
 * production; locally, the origin of the current request.
 */
export async function siteUrl(): Promise<string> {
  const configured = process.env.BETTER_AUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}
