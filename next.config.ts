import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const headers = securityHeaders({
  dev: process.env.NODE_ENV === "development",
  production: process.env.NODE_ENV === "production",
  vercelEnv: process.env.VERCEL_ENV,
});

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  // End-to-end tests build into their own folder, so they can run while `npm run dev` does.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers }];
  },
};

// Vercel BotID: adds the routes its invisible challenge needs (see instrumentation-client.ts).
export default withBotId(nextConfig);
