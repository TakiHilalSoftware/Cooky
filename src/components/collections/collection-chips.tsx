import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CollectionDto } from "@/server/features/collections/dto";

type Href = ComponentProps<typeof Link>["href"];

type CollectionChipsProps = {
  collections: CollectionDto[];
  /** The collection shown, or null for all dishes. */
  activeId: string | null;
  /** Where each chip goes: null = all dishes. Pages keep their other filters in it. */
  hrefFor: (collectionId: string | null) => Href;
  /** What the row narrows, for screen readers (e.g. "Collections"). */
  label: string;
  /** Extra chips at the end (e.g. "New collection"). */
  children?: ReactNode;
};

/** One row of collection chips (All, then each collection), shared by My Dishes and Cook. Scrolls sideways on phones. */
export function CollectionChips({ collections, activeId, hrefFor, label, children }: CollectionChipsProps) {
  const t = useTranslations("collections");
  const chip = (selected: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
      selected
        ? "border-primary-strong bg-primary text-primary-foreground"
        : "border-border bg-card hover:border-primary-strong",
    );

  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 sm:flex-wrap">
        <li>
          <Link
            href={hrefFor(null)}
            scroll={false}
            aria-current={activeId ? undefined : "page"}
            className={chip(!activeId)}
          >
            {t("all")}
          </Link>
        </li>
        {collections.map((c) => (
          <li key={c.id}>
            <Link
              href={hrefFor(c.id)}
              scroll={false}
              aria-current={activeId === c.id ? "page" : undefined}
              title={t("count", { count: c.dishCount })}
              className={chip(activeId === c.id)}
            >
              <span className="max-w-48 truncate">{c.name}</span>
              <span className="text-xs tabular-nums opacity-80">{c.dishCount}</span>
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}
