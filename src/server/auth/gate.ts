import "server-only";

import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";

/** Areas that need a signed-in account: every page under the (app) route group. */
export const SIGNED_IN_AREAS = [
  "/settings",
  "/dishes",
  "/onboarding",
  "/kitchen",
  "/cook",
  "/spin",
  "/assistant",
  "/planner",
  "/calendar",
  "/shopping",
  "/timer",
  "/friends",
  "/messages",
  "/admin",
] as const;

/**
 * The proxy's fast check (ARCHITECTURE §5.4): only whether a session cookie is
 * present. The page itself validates the session against the database.
 * Returns where to send a signed-out visitor, or null to let them through.
 */
export function signedOutRedirect(pathname: string, search: string, hasSessionCookie: boolean): string | null {
  if (hasSessionCookie) return null;
  const [, first = "", ...rest] = pathname.split("/");
  const locale = hasLocale(routing.locales, first) ? first : routing.defaultLocale;
  const inner = hasLocale(routing.locales, first) ? `/${rest.join("/")}` : pathname;
  const isProtected = SIGNED_IN_AREAS.some((area) => inner === area || inner.startsWith(`${area}/`));
  if (!isProtected) return null;
  const next = encodeURIComponent(`${inner}${search}`);
  return `/${locale}/login?next=${next}`;
}
