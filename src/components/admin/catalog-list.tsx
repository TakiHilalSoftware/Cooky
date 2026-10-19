import { ChevronRightIcon, PlusIcon, StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { CatalogRowDto, Paged } from "@/server/features/admin/dto";

import { AdminHeader, EmptyRow, Pager, SearchBox } from "./admin-ui";

/** The Discover catalog: saves per dish and missing translations at a glance (PRD §3.8). */
export function CatalogList({ catalog, q }: { catalog: Paged<CatalogRowDto>; q: string }) {
  const t = useTranslations("admin.catalog");
  const tDishes = useTranslations("dishes");
  return (
    <>
      <AdminHeader
        title={t("heading")}
        description={t("description", { count: catalog.total })}
        action={
          <Button asChild>
            <Link href="/admin/catalog/new">
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              {t("new")}
            </Link>
          </Button>
        }
      />
      <SearchBox label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={q} />
      {catalog.rows.length === 0 ? (
        <EmptyRow>{q ? t("noMatch", { q }) : t("none")}</EmptyRow>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {catalog.rows.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/catalog/${d.id}`} className="flex min-h-16 items-center gap-3 p-4 hover:bg-muted">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{d.name}</span>
                    {d.featured ? (
                      <>
                        <StarIcon aria-hidden="true" className="size-4 shrink-0 fill-primary text-primary" />
                        <span className="sr-only">{t("featured")}</span>
                      </>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>
                      {d.country} · {tDishes(`course.${d.course}`)} · {t("saves", { count: d.saves })}
                    </span>
                    {d.missing.map((lang) => (
                      <Badge key={lang} variant="destructive">
                        {t(`missing.${lang}`)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager path="/admin/catalog" query={{ q }} page={catalog.page} pageCount={catalog.pageCount} />
    </>
  );
}
