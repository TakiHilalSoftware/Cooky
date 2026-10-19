import { getSessionCookie } from "better-auth/cookies";
import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { signedOutRedirect } from "@/server/auth/gate";
import { env } from "@/server/env";
import { buildCsp } from "@/server/security/headers";
import { storageImageHost } from "@/server/storage/host";

const intl = createIntlMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const loginRedirect = signedOutRedirect(
    pathname,
    search,
    Boolean(getSessionCookie(request, { cookiePrefix: "cooky" })),
  );
  if (loginRedirect) return NextResponse.redirect(new URL(loginRedirect, request.url));

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: env.NODE_ENV === "development",
    pusherCluster: env.NEXT_PUBLIC_PUSHER_CLUSTER,
    imageHosts: [storageImageHost()].filter((host) => host !== null),
  });

  // Next reads the nonce from the request's CSP header while rendering and
  // stamps it on its own scripts; next-intl forwards these request headers.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes, build assets and files with an extension
      // (icons, manifest, robots) don't need locale handling or a nonce.
      source: "/((?!api|_next|_vercel|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
