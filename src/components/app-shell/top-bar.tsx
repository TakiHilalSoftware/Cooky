import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AccountSummaryDto } from "@/server/features/account/dto";

import { AccountMenu } from "./account-menu";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

type TopBarProps = {
  /** Signed-in summary, null when signed out, undefined when unknown (error pages). */
  account?: AccountSummaryDto | null;
};

/** Public top bar: logo, language, theme, and account or log-in actions. */
export function TopBar({ account }: TopBarProps) {
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={t("common.homeLink")}
          className="-ms-1 inline-flex min-h-11 items-center rounded-lg px-1"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/pricing">{t("common.pricing")}</Link>
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
          {account ? <AccountMenu account={account} /> : null}
          {account === null ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">{t("account.logIn")}</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/signup">{t("account.signUp")}</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
