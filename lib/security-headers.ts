/**
 * Security headers for every response, including the Content Security Policy.
 *
 * Why no nonces: the app uses Cache Components and partial prefetching, so
 * pages have a prerendered static shell, and a per-request nonce can't be
 * put into a static shell (see Next.js's content-security-policy guide).
 * Inline scripts are therefore allowed, but everything else is locked to
 * this site: scripts, styles and fonts can't load from anywhere else, data
 * can't be sent anywhere else (connect-src, form-action, img-src), and the
 * app can't be framed. That stops an injected script from loading more code
 * or sending patient data out.
 */

type Environment = {
  /** `next dev`: React needs eval for its error overlays. */
  dev: boolean;
  /** VERCEL_ENV: "production", "preview" or "development" on Vercel; undefined elsewhere. */
  vercelEnv?: string;
};

/** Sources the Vercel Toolbar needs, on preview deployments only. */
const VERCEL_TOOLBAR = {
  script: ["https://vercel.live"],
  connect: ["https://vercel.live", "wss://ws-us3.pusher.com"],
  img: ["https://vercel.live", "https://vercel.com"],
  frame: ["https://vercel.live"],
  style: ["https://vercel.live"],
  font: ["https://vercel.live", "https://assets.vercel.com"],
};

export function contentSecurityPolicy({ dev, vercelEnv }: Environment): string {
  const toolbar = vercelEnv === "preview";
  const extra = (key: keyof typeof VERCEL_TOOLBAR) =>
    toolbar ? VERCEL_TOOLBAR[key] : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      ...extra("script"),
    ],
    "style-src": ["'self'", "'unsafe-inline'", ...extra("style")],
    "img-src": ["'self'", "data:", "blob:", ...extra("img")],
    "font-src": ["'self'", ...extra("font")],
    "connect-src": ["'self'", ...extra("connect")],
    "frame-src": toolbar ? extra("frame") : ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, sources]) => `${name} ${sources.join(" ")}`,
  );
  // On Vercel every request is HTTPS; locally the app runs on plain http.
  if (vercelEnv) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(env: Environment & { production: boolean }) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(env.production
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : []),
  ];
}
