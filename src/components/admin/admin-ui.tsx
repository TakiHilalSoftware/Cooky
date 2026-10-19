import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Small shared pieces for admin pages. Filters and paging are plain links and
// GET forms, so every view has a shareable URL and works without JavaScript.

type Query = Record<string, string | number | undefined | null>;

function hrefWith(path: string, query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h2 className="font-heading text-3xl">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** Previous / next with "page 2 of 5"; keeps the other filters. */
export function Pager({
  path,
  query,
  page,
  pageCount,
}: {
  path: string;
  query: Query;
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("admin.common");
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={t("pages")} className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefWith(path, { ...query, page: page - 1 })}>
            <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" className="rtl:-scale-x-100" />
            {t("previous")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground tabular-nums">{t("pageOf", { page, pageCount })}</span>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefWith(path, { ...query, page: page + 1 })}>
            {t("next")}
            <ChevronRightIcon aria-hidden="true" data-icon="inline-end" className="rtl:-scale-x-100" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** A row of filter links (status, type…); the current one is marked. */
export function FilterTabs({
  label,
  path,
  query,
  param,
  options,
  value,
}: {
  label: string;
  path: string;
  query: Query;
  param: string;
  options: { value: string | null; label: string }[];
  value: string | null;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <li key={option.value ?? "all"}>
              <Link
                href={hrefWith(path, { ...query, [param]: option.value, page: undefined })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-3 text-sm whitespace-nowrap",
                  active ? "border-primary-strong bg-secondary font-medium" : "border-border hover:bg-muted",
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A GET search box: the query lands in the URL. */
export function SearchBox({
  label,
  placeholder,
  value,
  hidden,
}: {
  label: string;
  placeholder: string;
  value: string;
  hidden?: Query;
}) {
  const t = useTranslations("admin.common");
  return (
    <form role="search" method="get" className="flex gap-2">
      <label className="sr-only" htmlFor="admin-search">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="admin-search"
          name="q"
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          className="h-11 ps-9"
        />
      </div>
      {Object.entries(hidden ?? {}).map(([key, v]) =>
        v === undefined || v === null || v === "" ? null : (
          <input key={key} type="hidden" name={key} value={String(v)} />
        ),
      )}
      <Button type="submit" variant="outline" className="h-11">
        {t("search")}
      </Button>
    </form>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
