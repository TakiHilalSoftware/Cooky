import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogDishLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-2/3 max-w-lg" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}
