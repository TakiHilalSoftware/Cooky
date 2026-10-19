import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function FriendProfileLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-32 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
