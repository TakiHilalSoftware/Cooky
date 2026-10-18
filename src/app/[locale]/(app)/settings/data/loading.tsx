import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function DataLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-3xl border border-border bg-card p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-10 w-40" />
        </div>
      ))}
    </div>
  );
}
