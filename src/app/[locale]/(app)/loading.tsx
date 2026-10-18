import { useTranslations } from "next-intl";

import { PageSkeleton } from "@/components/feedback/page-skeleton";

export default function AppLoading() {
  const t = useTranslations("common");
  return <PageSkeleton label={t("loading")} />;
}
