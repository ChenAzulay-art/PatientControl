"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

/**
 * Browser client for the login, sign-up, password and two-factor forms.
 * These go through /api/auth so Better Auth's rate limits apply.
 */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: { locale: { type: "string", required: false } },
    }),
    twoFactorClient(),
    organizationClient(),
  ],
});

type AuthError = { status: number; code?: string } | null | undefined;

/** Maps a Better Auth error to a key in `auth.errors` or a form-specific key. */
export function authErrorKind(
  error: AuthError,
): "tooManyRequests" | "unauthorized" | "forbidden" | "conflict" | "generic" {
  if (!error) return "generic";
  if (error.status === 429) return "tooManyRequests";
  if (error.status === 401) return "unauthorized";
  if (error.status === 403) return "forbidden";
  if (error.status === 422 || error.code?.startsWith("USER_ALREADY_EXISTS"))
    return "conflict";
  return "generic";
}
