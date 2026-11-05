import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "@/lib/i18n/config";

/** Paths (after the locale) that need a session cookie. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/onboarding",
  "/setup-2fa",
];

function isProtected(path: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * 1. Adds the locale to URLs that don't have one (/login → /he/login).
 * 2. Sends visitors without a session cookie away from signed-in pages.
 *
 * This is only a fast, optimistic check. The real authorization happens in
 * lib/dal, close to the data, on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first = "", ...rest] = pathname.split("/");

  if (!isLocale(first)) {
    const locale = negotiateLocale(
      request.cookies.get(LOCALE_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const path = `/${rest.join("/")}`;
  if (isProtected(path) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${first}/login`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
