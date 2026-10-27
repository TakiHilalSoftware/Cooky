"use client";

import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  ChefHatIcon,
  CompassIcon,
  CreditCardIcon,
  DicesIcon,
  EllipsisIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  RefrigeratorIcon,
  SettingsIcon,
  ShieldIcon,
  UsersRoundIcon,
  ShoppingBasketIcon,
  TimerIcon,
  DownloadIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useInstallPrompt } from "@/components/pwa";
import { CookyIcon } from "@/components/brand/cooky-icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { AccountSummaryDto } from "@/server/features/account/dto";

type NavItem = {
  href:
    | "/cook"
    | "/dishes"
    | "/kitchen"
    | "/planner"
    | "/calendar"
    | "/shopping"
    | "/timer"
    | "/spin"
    | "/assistant"
    | "/discover"
    | "/friends"
    | "/messages"
    | "/admin"
    | "/settings"
    | "/settings/billing";
  key:
    | "cook"
    | "dishes"
    | "kitchen"
    | "planner"
    | "calendar"
    | "shopping"
    | "timer"
    | "spin"
    | "assistant"
    | "discover"
    | "friends"
    | "messages"
    | "admin"
    | "settings"
    | "billing";
  icon: LucideIcon;
};

/** Where the signed-in app goes (PRD §3.0). */
const MAIN: NavItem[] = [
  { href: "/cook", key: "cook", icon: ChefHatIcon },
  { href: "/dishes", key: "dishes", icon: BookOpenIcon },
  { href: "/kitchen", key: "kitchen", icon: RefrigeratorIcon },
  { href: "/planner", key: "planner", icon: ClipboardListIcon },
  { href: "/calendar", key: "calendar", icon: CalendarDaysIcon },
  { href: "/shopping", key: "shopping", icon: ShoppingBasketIcon },
  { href: "/timer", key: "timer", icon: TimerIcon },
  { href: "/spin", key: "spin", icon: DicesIcon },
  { href: "/assistant", key: "assistant", icon: MessageCircleIcon },
  { href: "/discover", key: "discover", icon: CompassIcon },
  { href: "/friends", key: "friends", icon: UsersRoundIcon },
  { href: "/messages", key: "messages", icon: MessagesSquareIcon },
];
const ADMIN: NavItem = { href: "/admin", key: "admin", icon: ShieldIcon };
const ACCOUNT: NavItem[] = [
  { href: "/settings", key: "settings", icon: SettingsIcon },
  { href: "/settings/billing", key: "billing", icon: CreditCardIcon },
];
/** Thumb-reachable on phones (PRD §3.0: Cook, Dishes, Planner, Shopping, More); the rest live under "More". */
const PHONE_PRIMARY: NavItem["key"][] = ["cook", "dishes", "planner", "shopping"];

type Badges = Pick<AccountSummaryDto, "badges" | "isAdmin">;

/** The account items, with Admin for admins (PRD §3.0). */
function accountItems({ isAdmin }: Badges): NavItem[] {
  return isAdmin ? [ADMIN, ...ACCOUNT] : ACCOUNT;
}

type Badge = { label: string | null; mark: "count" | "dot" | null; count: number };

/** A count on Friends, a dot on Messages: announced in the link's name, drawn as a pill or dot. */
function useBadge({ badges }: Badges) {
  const t = useTranslations("nav");
  return (key: NavItem["key"]): Badge => {
    if (key === "friends" && badges.newRequests > 0) {
      return { label: t("newRequests", { count: badges.newRequests }), mark: "count", count: badges.newRequests };
    }
    if (key === "messages" && badges.unreadMessages) return { label: t("unread"), mark: "dot", count: 0 };
    return { label: null, mark: null, count: 0 };
  };
}

function BadgeMark({ badge }: { badge: Badge }) {
  return (
    <>
      {badge.label ? <span className="sr-only">, {badge.label}</span> : null}
      {badge.mark === "count" ? (
        <span
          aria-hidden="true"
          className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums"
        >
          {badge.count > 9 ? "9+" : badge.count}
        </span>
      ) : badge.mark === "dot" ? (
        <span aria-hidden="true" className="ms-auto size-2.5 shrink-0 rounded-full bg-primary" />
      ) : null}
    </>
  );
}

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/settings" ? pathname === "/settings" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop: a quiet column of places, below the top bar. */
export function AppSidebar({ account }: { account: Badges }) {
  const t = useTranslations("nav");
  const isActive = useActive();
  const badgeFor = useBadge(account);
  const item = (entry: NavItem) => {
    const active = isActive(entry.href);
    return (
      <li key={entry.key}>
        <Link
          href={entry.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
            active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {/* The current place is marked with the brand's mark, set into the rail like a tile. */}
          {active ? <CookyIcon className="absolute -start-1.5 top-1/2 size-3 -translate-y-1/2" /> : null}
          <entry.icon aria-hidden="true" className={cn("size-5", active && "text-primary-strong")} />
          {t(entry.key)}
          <BadgeMark badge={badgeFor(entry.key)} />
        </Link>
      </li>
    );
  };
  return (
    <nav
      aria-label={t("label")}
      className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 flex-col justify-between border-e border-border/70 px-3 py-6 lg:flex"
    >
      <ul className="space-y-1">{MAIN.map(item)}</ul>
      <ul className="space-y-1">{accountItems(account).map(item)}</ul>
    </nav>
  );
}

/** Phones: a bottom bar with the everyday places and "More" for the rest. */
export function BottomNav({ account }: { account: Badges }) {
  const t = useTranslations("nav");
  const tInstall = useTranslations("install");
  const { canInstall, isInstalled, promptToInstall } = useInstallPrompt();
  const isActive = useActive();
  const badgeFor = useBadge(account);
  const [open, setOpen] = useState(false);
  const primary = MAIN.filter((i) => PHONE_PRIMARY.includes(i.key));
  const more = [...MAIN.filter((i) => !PHONE_PRIMARY.includes(i.key)), ...accountItems(account)];
  const moreActive = more.some((i) => isActive(i.href));
  // Something waiting behind "More" (a friend request, a message) shows a dot on it.
  const moreNews = more.some((i) => badgeFor(i.key).mark !== null);
  const cell =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-medium leading-tight";

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg gap-1 px-2 py-1">
        {primary.map((entry) => {
          const active = isActive(entry.href);
          return (
            <li key={entry.key} className="flex flex-1">
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(cell, "relative", active ? "text-foreground" : "text-muted-foreground")}
              >
                {active ? <CookyIcon className="absolute top-1 size-2" /> : null}
                <entry.icon aria-hidden="true" className={cn("mt-1 size-5", active && "text-primary-strong")} />
                {t(entry.key)}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={cn(cell, "relative", moreActive ? "text-foreground" : "text-muted-foreground")}>
              <EllipsisIcon aria-hidden="true" className={cn("size-5", moreActive && "text-primary-strong")} />
              {t("more")}
              {moreNews ? (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute end-[calc(50%-1rem)] top-2 size-2.5 rounded-full bg-primary"
                  />
                  <span className="sr-only">, {t("somethingNew")}</span>
                </>
              ) : null}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <SheetHeader>
                <SheetTitle>{t("more")}</SheetTitle>
              </SheetHeader>
              <ul className="grid grid-cols-2 gap-2 px-4">
                {canInstall && !isInstalled ? (
                  <li className="col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        void promptToInstall();
                      }}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 font-medium text-foreground transition-colors hover:bg-primary/15"
                    >
                      <DownloadIcon aria-hidden="true" className="size-5 shrink-0 text-primary-strong" />
                      <span className="min-w-0 truncate">{tInstall("button")}</span>
                    </button>
                  </li>
                ) : null}
                {more.map((entry) => (
                  <li key={entry.key}>
                    <Link
                      href={entry.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive(entry.href) ? "page" : undefined}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-border px-4 font-medium"
                    >
                      <entry.icon aria-hidden="true" className="size-5 shrink-0 text-primary-strong" />
                      <span className="min-w-0 truncate">{t(entry.key)}</span>
                      <BadgeMark badge={badgeFor(entry.key)} />
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
