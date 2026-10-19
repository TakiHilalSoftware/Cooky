import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="flex flex-wrap gap-2">
        {[24, 32, 20, 28, 36, 24].map((w, i) => (
          <Skeleton key={i} className="h-11 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
    </div>
  );
}
