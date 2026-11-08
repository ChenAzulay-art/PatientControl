import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const directives = (policy: string) =>
  Object.fromEntries(
    policy.split("; ").map((part) => {
      const [name, ...sources] = part.split(" ");
      return [name, sources];
    }),
  );

describe("contentSecurityPolicy", () => {
  it("locks production to this site", () => {
    const csp = directives(
      contentSecurityPolicy({ dev: false, vercelEnv: "production" }),
    );
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["upgrade-insecure-requests"]).toEqual([]);
  });

  it("allows eval only in development, and http when not on Vercel", () => {
    const dev = directives(contentSecurityPolicy({ dev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("allows the Vercel Toolbar on preview deployments only", () => {
    const preview = contentSecurityPolicy({ dev: false, vercelEnv: "preview" });
    expect(directives(preview)["script-src"]).toContain("https://vercel.live");
    expect(
      contentSecurityPolicy({ dev: false, vercelEnv: "production" }),
    ).not.toContain("vercel.live");
  });
});

describe("securityHeaders", () => {
  it("adds HSTS in production only", () => {
    const keys = (production: boolean) =>
      securityHeaders({ dev: false, production }).map((h) => h.key);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
    expect(keys(false)).toContain("Content-Security-Policy");
  });
});
