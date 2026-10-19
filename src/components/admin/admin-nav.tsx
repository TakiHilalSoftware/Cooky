"use client";

import {
  BookMarkedIcon,
  FlagIcon,
  LayoutDashboardIcon,
  MessageSquareWarningIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin", key: "overview", icon: LayoutDashboardIcon },
  { href: "/admin/users", key: "users", icon: UsersIcon },
  { href: "/admin/catalog", key: "catalog", icon: BookMarkedIcon },
  { href: "/admin/content", key: "content", icon: ShieldAlertIcon },
  { href: "/admin/reports", key: "reports", icon: FlagIcon },
  { href: "/admin/feedback", key: "feedback", icon: MessageSquareWarningIcon },
  { href: "/admin/audit", key: "audit", icon: ScrollTextIcon },
] as const;

/** Admin sections: a column on wide screens, a scrollable row on phones (like Settings). */
export function AdminNav({ counts }: { counts: { reports: number; feedback: number } }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {SECTIONS.map(({ href, key, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          const count = key === "reports" ? counts.reports : key === "feedback" ? counts.feedback : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(key)}
                {count > 0 ? (
                  <span className="ms-auto rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                    {count}
                    <span className="sr-only"> {t("open")}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
