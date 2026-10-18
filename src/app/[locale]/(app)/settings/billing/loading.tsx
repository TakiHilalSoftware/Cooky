import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-5 w-72 max-w-full" />
      <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
