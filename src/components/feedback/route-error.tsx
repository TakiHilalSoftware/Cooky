"use client";

import { BookOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { reportClientError } from "@/lib/report-error";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";

import { ErrorState } from "./error-state";

/**
 * A page inside the signed-in area failed. Its layout (menu, top bar) stays,
 * so the person can retry or go somewhere else instead of losing the app.
 */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-10 sm:px-6">
      <ErrorState
        headingLevel={1}
        title={t("errorPage.title")}
        description={t("errorPage.inAppDescription")}
        retryLabel={t("common.tryAgain")}
        onRetry={retry}
        secondaryAction={
          <Button asChild size="lg" variant="outline">
            <Link href={HOME_AFTER_SIGN_IN}>
              <BookOpenIcon aria-hidden="true" data-icon="inline-start" />
              {t("errorPage.toDishes")}
            </Link>
          </Button>
        }
      />
    </div>
  );
}
