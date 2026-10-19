import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
