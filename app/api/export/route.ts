import { exportClinicData, type ExportScope } from "@/lib/dal/export";
import { confirmPassword } from "@/lib/dal/reauth";
import { findClinicContext } from "@/lib/dal/session";

/**
 * Downloads the clinic's data, or one patient's, as JSON.
 *
 * POST with a JSON body: { scope: "clinic", password } or
 * { scope: "patient", patientId }. The whole clinic needs the password
 * again; one patient needs only the session, like opening their card.
 * Only same-site requests are accepted.
 */
export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (
    (site && site !== "same-origin") ||
    (origin && origin !== new URL(request.url).origin)
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const ctx = await findClinicContext();
  if (!ctx) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    scope?: unknown;
    patientId?: unknown;
    password?: unknown;
  } | null;

  let scope: ExportScope;
  if (body?.scope === "clinic") {
    const check = await confirmPassword(ctx, String(body.password ?? ""));
    if (check === "tooMany") {
      return Response.json({ error: "tooMany" }, { status: 429 });
    }
    if (check !== "ok") {
      return Response.json({ error: "wrongPassword" }, { status: 403 });
    }
    scope = { kind: "clinic" };
  } else if (body?.scope === "patient" && typeof body.patientId === "string") {
    scope = { kind: "patient", id: body.patientId };
  } else {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const data = await exportClinicData(ctx, scope);
  if (!data) return Response.json({ error: "notFound" }, { status: 404 });

  const date = data.exportedAt.slice(0, 10);
  const filename =
    scope.kind === "clinic"
      ? `clinic-${ctx.clinic.slug}-${date}.json`
      : `patient-${scope.id.slice(0, 8)}-${date}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
