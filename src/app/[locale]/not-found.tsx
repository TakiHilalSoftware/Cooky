import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PublicShell } from "@/components/app-shell/public-shell";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations();
  return (
    <PublicShell>
      <EmptyState
        headingLevel={1}
        className="py-20"
        title={t("notFound.title")}
        description={t("notFound.description")}
        action={
          <Button asChild size="lg">
            <Link href="/">
              <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" className="rtl:-scale-x-100" />
              {t("common.backToHome")}
            </Link>
          </Button>
        }
      />
    </PublicShell>
  );
}
