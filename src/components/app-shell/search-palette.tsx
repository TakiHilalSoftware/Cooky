"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BookOpenIcon,
  CompassIcon,
  CornerDownLeftIcon,
  FileTextIcon,
  PartyPopperIcon,
  SearchIcon,
  UsersRoundIcon,
  UtensilsIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { unwrap } from "@/components/query/action-query";
import { queryKeys } from "@/components/query/keys";
import { useDebouncedValue } from "@/components/query/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { search } from "@/server/actions/search";
import type { SearchResultsDto } from "@/server/features/search/dto";

const DEBOUNCE_MS = 180;

/** Pages anyone signed in can jump to, matched on their translated name. */
const PAGES = [
  ["/cook", "cook"],
  ["/dishes", "dishes"],
  ["/dishes/new", "newDish"],
  ["/kitchen", "kitchen"],
  ["/planner", "planner"],
  ["/planner/events", "events"],
  ["/calendar", "calendar"],
  ["/shopping", "shopping"],
  ["/timer", "timer"],
  ["/spin", "spin"],
  ["/assistant", "assistant"],
  ["/discover", "discover"],
  ["/friends", "friends"],
  ["/messages", "messages"],
  ["/settings", "settings"],
  ["/settings/billing", "billing"],
] as const;

const GROUPS = ["pages", "dishes", "shared", "discover", "friends", "events"] as const;
type Result = { key: string; href: string; label: string; group: (typeof GROUPS)[number] };

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Global search (PRD §3.5): Ctrl/⌘+K or "/" opens it; ↑/↓ move, Enter opens,
 * Esc closes. Pages match instantly; dishes, Discover and events come from the server.
 */
export function SearchPalette() {
  const t = useTranslations("search");
  const tNav = useTranslations("search.pages");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const typed = query.trim();
  const term = useDebouncedValue(typed, DEBOUNCE_MS);
  const lookup = useQuery({
    queryKey: queryKeys.search(locale, term),
    queryFn: async () => unwrap(await search({ q: term, locale })),
    enabled: open && term.length >= 2,
    // Results stay on screen while the next word is looked up, so the list doesn't flicker.
    placeholderData: keepPreviousData,
  });
  const remote: SearchResultsDto | null = typed.length >= 2 ? (lookup.data ?? null) : null;
  // Still typing, or the server hasn't answered for this word yet.
  const searching = typed.length >= 2 && (typed !== term || lookup.isFetching);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function change(value: string) {
    setQuery(value);
    setActive(0);
  }

  const folded = fold(query.trim());
  const results: Result[] = [
    ...PAGES.filter(([, key]) => folded.length > 0 && fold(tNav(key)).includes(folded)).map(([href, key]) => ({
      key: `page-${key}`,
      href,
      label: tNav(key),
      group: "pages" as const,
    })),
    ...(remote?.dishes ?? []).map((d) => ({
      key: `dish-${d.id}`,
      href: `/dishes/${d.id}`,
      label: d.name,
      group: "dishes" as const,
    })),
    ...(remote?.shared ?? []).map((d) => ({
      key: `shared:${d.id}`,
      href: `/dishes/${d.id}`,
      label: d.name,
      group: "shared" as const,
    })),
    ...(remote?.friends ?? []).map((f) => ({
      key: `friend:${f.id}`,
      href: `/friends/${f.id}`,
      label: f.name,
      group: "friends" as const,
    })),
    ...(remote?.discover ?? []).map((d) => ({
      key: `disc-${d.slug}`,
      href: `/discover/${d.slug}`,
      label: d.name,
      group: "discover" as const,
    })),
    ...(remote?.events ?? []).map((e) => ({
      key: `event-${e.id}`,
      href: `/planner/events/${e.id}`,
      label: e.name,
      group: "events" as const,
    })),
  ];

  function go(result: Result | undefined) {
    if (!result) return;
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  const ICONS = {
    pages: FileTextIcon,
    dishes: BookOpenIcon,
    shared: UtensilsIcon,
    discover: CompassIcon,
    friends: UsersRoundIcon,
    events: PartyPopperIcon,
  } as const;
  const groups = GROUPS.filter((g) => results.some((r) => r.group === g));

  return (
    <>
      <Button variant="ghost" className="gap-2 px-2.5 text-muted-foreground" onClick={() => setOpen(true)}>
        <SearchIcon aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("open")}</span>
        <kbd className="hidden rounded border border-border px-1.5 text-xs lg:inline">Ctrl K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("hint")}</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <SearchIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            <input
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-activedescendant={results[active] ? `${listId}-${results[active].key}` : undefined}
              aria-label={t("title")}
              value={query}
              maxLength={80}
              placeholder={t("placeholder")}
              onChange={(e) => change(e.target.value)}
              onKeyDown={onKeyDown}
              className="h-14 flex-1 bg-transparent text-base outline-none"
            />
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-2">
            {typed.length < 2 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("hint")}</p>
            ) : results.length === 0 ? (
              <p
                role="status"
                className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground"
              >
                {searching ? (
                  <>
                    <Spinner aria-hidden="true" />
                    {t("searching")}
                  </>
                ) : lookup.isError ? (
                  t("unavailable")
                ) : (
                  t("noResults", { query: typed })
                )}
              </p>
            ) : (
              <ul id={listId} role="listbox" aria-label={t("title")}>
                {groups.map((group) => (
                  <li key={group} role="presentation">
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase">
                      {t(`groups.${group}`)}
                    </p>
                    <ul role="presentation">
                      {results
                        .filter((r) => r.group === group)
                        .map((result) => {
                          const index = results.indexOf(result);
                          const Icon = ICONS[result.group];
                          return (
                            <li
                              key={result.key}
                              id={`${listId}-${result.key}`}
                              role="option"
                              aria-selected={index === active}
                              onMouseEnter={() => setActive(index)}
                              onClick={() => go(result)}
                              className={cn(
                                "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3",
                                index === active && "bg-secondary",
                              )}
                            >
                              <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{result.label}</span>
                              {index === active ? (
                                <CornerDownLeftIcon
                                  aria-hidden="true"
                                  className="size-4 text-muted-foreground rtl:-scale-x-100"
                                />
                              ) : null}
                            </li>
                          );
                        })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
