import { PublicShell } from "@/components/app-shell/public-shell";

export default function MarketingLayout({ children }: LayoutProps<"/[locale]">) {
  return <PublicShell>{children}</PublicShell>;
}
