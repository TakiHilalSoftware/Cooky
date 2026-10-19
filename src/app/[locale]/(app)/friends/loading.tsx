import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function FriendsLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
