import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function CookLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
