import { useFormatter, useTranslations } from "next-intl";

import { isMeteredFeature } from "@/lib/plan-features";
import type { AdminOverviewDto } from "@/server/features/admin/dto";

import { AdminHeader, StatTile } from "./admin-ui";

/** People, money, content and try usage at a glance (PRD §3.8). */
export function AdminOverview({ overview: o }: { overview: AdminOverviewDto }) {
  const t = useTranslations("admin.overview");
  const tFeatures = useTranslations("features");
  const format = useFormatter();
  const n = (value: number) => format.number(value);
  return (
    <>
      <AdminHeader title={t("heading")} description={t("description")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label={t("users")} value={n(o.users)} hint={t("newThisWeek", { count: o.newThisWeek })} />
        <StatTile
          label={t("mrr")}
          value={format.number(o.mrrCents / 100, { style: "currency", currency: "EUR" })}
          hint={t("mrrHint")}
        />
        <StatTile label={t("subscriptions")} value={n(o.activeSubscriptions)} hint={t("trials", { count: o.trials })} />
        <StatTile label={t("catalog")} value={n(o.catalogDishes)} />
        <StatTile label={t("userDishes")} value={n(o.userDishes)} hint={t("shared", { count: o.sharedDishes })} />
        <StatTile label={t("reviews")} value={n(o.writtenReviews)} />
      </div>
      <section aria-labelledby="tries-heading" className="space-y-3 rounded-3xl border border-border bg-card p-5">
        <h3 id="tries-heading" className="font-heading text-xl">
          {t("triesHeading")}
        </h3>
        {o.triesThisMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTries")}</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {o.triesThisMonth.map((row) => (
              <div key={row.feature} className="rounded-2xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">
                  {isMeteredFeature(row.feature) ? tFeatures(`names.${row.feature}`) : row.feature}
                </dt>
                <dd className="font-heading text-2xl tabular-nums">{n(row.used)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}
