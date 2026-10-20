import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { PAGE_CACHE_SECONDS } from "./src/lib/page-cache";
import { staticSecurityHeaders } from "./src/server/security/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Cache Components / Partial Prerendering are left off on purpose: the
  // nonce-based CSP required by docs/ARCHITECTURE.md needs every page to be
  // rendered per request, and Next documents PPR as incompatible with nonces.
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  experimental: {
    // Recipe backups go up to 5 MB (PRD §3.2); the default 1 MB would refuse them.
    // Each action still validates and caps its own input.
    serverActions: { bodySizeLimit: "6mb" },
    // Pages already seen show again at once, then refresh in the background.
    staleTimes: { dynamic: PAGE_CACHE_SECONDS },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: staticSecurityHeaders() }];
  },
};

export default withNextIntl(nextConfig);
