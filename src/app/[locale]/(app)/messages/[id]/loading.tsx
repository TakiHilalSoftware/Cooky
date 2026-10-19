import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-14 w-full rounded-2xl" />
      {[60, 40, 70, 50].map((w, i) => (
        <Skeleton
          key={i}
          className={i % 2 ? "ms-auto h-12 rounded-3xl" : "h-12 rounded-3xl"}
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}
