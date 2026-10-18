"use client";

import { HomeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { PublicShell } from "@/components/app-shell/public-shell";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { reportClientError } from "@/lib/report-error";

export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <PublicShell>
      <ErrorState
        headingLevel={1}
        title={t("errorPage.title")}
        description={t("errorPage.description")}
        retryLabel={t("common.tryAgain")}
        onRetry={retry}
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href="/">
              <HomeIcon aria-hidden="true" data-icon="inline-start" />
              {t("common.backToHome")}
            </Link>
          </Button>
        }
      />
    </PublicShell>
  );
}
