import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { getDictionaryFor } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

export const APP_NAME = "Patient Control";

/** The `locale` additional field isn't in the callback's user type. */
function localeOf(user: object): unknown {
  return "locale" in user ? user.locale : undefined;
}

async function emailCopy(
  userLocale: unknown,
  kind: "verify" | "reset",
  values: { name: string; url: string },
) {
  const t = await getDictionaryFor(
    isLocale(userLocale) ? userLocale : defaultLocale,
  );
  return {
    subject: t.emails[kind].subject,
    text: format(t.emails[kind].body, values),
  };
}

/**
 * In production the URL comes from BETTER_AUTH_URL. Locally, any localhost
 * port is accepted, since the dev server moves to another port when 3000 is taken.
 */
const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : {
        allowedHosts: ["localhost:*", "127.0.0.1:*"],
        protocol: "http" as const,
      });

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    additionalFields: {
      // The interface language, also used for emails sent to the practitioner.
      locale: {
        type: "string",
        required: false,
        defaultValue: defaultLocale,
        input: true,
      },
    },
  },
  session: {
    // Sign out after 12 hours; the expiry rolls forward at most once an hour while in use.
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const copy = await emailCopy(localeOf(user), "reset", {
        name: user.name,
        url,
      });
      await sendEmail({ to: user.email, ...copy });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      const copy = await emailCopy(localeOf(user), "verify", {
        name: user.name,
        url,
      });
      await sendEmail({ to: user.email, ...copy });
    },
  },
  rateLimit: {
    // Always on in production. End-to-end tests sign up several accounts a
    // minute, so their test server turns it off with AUTH_RATE_LIMIT=off.
    enabled:
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_RATE_LIMIT !== "off",
    // Stored in Postgres so limits hold across serverless instances.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await recordAudit({
            actorId: session.userId,
            action: "auth.session_created",
          });
        },
      },
    },
  },
  plugins: [
    twoFactor({ issuer: APP_NAME }),
    // A clinic is an organization; its owner is the practitioner. Staff come later.
    organization({ allowUserToCreateOrganization: true, organizationLimit: 1 }),
    // Must stay last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
