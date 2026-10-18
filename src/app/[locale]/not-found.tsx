import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PublicShell } from "@/components/app-shell/public-shell";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getAccountSummary } from "@/server/features/account/queries";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <PublicShell account={await getAccountSummary()}>
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
