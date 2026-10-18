"use client";

import { ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/settings", key: "account", icon: UserRoundIcon },
  { href: "/settings/security", key: "security", icon: ShieldCheckIcon },
] as const;

/** Sections of Settings: a sidebar on wide screens, a scrollable row of tabs on phones. */
export function SettingsNav() {
  const t = useTranslations("settings");
  const pathname = usePathname();
  return (
    <nav aria-label={t("navLabel")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {SECTIONS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
