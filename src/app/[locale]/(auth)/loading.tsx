import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <span className="sr-only">{t("loading")}</span>
      <div className="space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
