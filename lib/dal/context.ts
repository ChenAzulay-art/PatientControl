import type { CurrentClinic, CurrentUser } from "./session";

/**
 * Who is acting and in which clinic. Only `requireClinic()` produces this,
 * after checking the session, two-step verification and membership. Every
 * clinic data function takes it, so queries are always scoped to
 * `clinic.id` and never to an id that came from the request.
 */
export type ClinicContext = { user: CurrentUser; clinic: CurrentClinic };

/** Postgres unique-violation error code. */
export const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { code?: unknown })?.code ??
    (error as { cause?: { code?: unknown } })?.cause?.code;
  return code === UNIQUE_VIOLATION;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from URLs and forms are checked before they reach a query. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
