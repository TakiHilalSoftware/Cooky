import { getLocale } from "next-intl/server";

import { PublicShell } from "@/components/app-shell/public-shell";
import { redirect } from "@/i18n/navigation";
import { getAccountSummary } from "@/server/features/account/queries";

/**
 * Signed-in area. The proxy only checks that a session cookie exists; this
 * layout validates the session against the database (ARCHITECTURE §5.4).
 */
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const account = await getAccountSummary();
  if (!account) return redirect({ href: "/login", locale: await getLocale() });
  return <PublicShell account={account}>{children}</PublicShell>;
}
