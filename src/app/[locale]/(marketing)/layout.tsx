import { PublicShell } from "@/components/app-shell/public-shell";
import { getAccountSummary } from "@/server/features/account/queries";

export default async function MarketingLayout({ children }: LayoutProps<"/[locale]">) {
  return <PublicShell account={await getAccountSummary()}>{children}</PublicShell>;
}
