import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function SpinLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
