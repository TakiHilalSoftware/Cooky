import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

/** Public top bar: logo, language and theme. Signed-in items join in Phase 1. */
export function TopBar() {
  const t = useTranslations("common");
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t("homeLink")} className="-ms-1 inline-flex min-h-11 items-center rounded-lg px-1">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
