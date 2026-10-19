import { useNow, useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import type { AccountSummaryDto } from "@/server/features/account/dto";

/** One footer for every page: where to explore, your account, and the legal pages. */
export function SiteFooter({ account }: { account?: AccountSummaryDto | null }) {
  const t = useTranslations("footer");
  const tAccount = useTranslations("account");
  const now = useNow();
  const link = "inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground";
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:px-6">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">{t("tagline")}</p>
        </div>
        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="text-sm font-medium">
            {t("explore")}
          </h2>
          <ul>
            <li>
              <Link href="/discover" className={link}>
                {t("discover")}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className={link}>
                {t("pricing")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-account">
          <h2 id="footer-account" className="text-sm font-medium">
            {t("account")}
          </h2>
          <ul>
            {account ? (
              <>
                <li>
                  <Link href="/dishes" className={link}>
                    {tAccount("dishes")}
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className={link}>
                    {tAccount("settings")}
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/login" className={link}>
                    {tAccount("logIn")}
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className={link}>
                    {tAccount("signUp")}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        <nav aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="text-sm font-medium">
            {t("legal")}
          </h2>
          <ul>
            <li>
              <Link href="/terms" className={link}>
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={link}>
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/refunds" className={link}>
                {t("refunds")}
              </Link>
            </li>
            <li>
              <Link href="/imprint" className={link}>
                {t("imprint")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        {t("rights", { year: now.getFullYear() })}
      </p>
    </footer>
  );
}
