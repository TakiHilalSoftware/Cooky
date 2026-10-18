import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
