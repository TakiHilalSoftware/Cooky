import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function AssistantLoading() {
  const t = useTranslations("common");
  return (
    <div
      role="status"
      className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[16rem_1fr]"
    >
      <span className="sr-only">{t("loading")}</span>
      <div className="hidden space-y-2 lg:block">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[70dvh] rounded-3xl" />
    </div>
  );
}
