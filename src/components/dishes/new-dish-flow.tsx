"use client";

import { ExternalLinkIcon, InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { UsageDto } from "@/server/features/billing/dto";
import type { DishDraftDto } from "@/server/features/dishes/dto";

import { DishForm } from "./dish-form";
import { ImportLinkCard } from "./import-link-card";

/** New dish: import from a link (optional), then review and save in the usual form. */
export function NewDishFlow({
  importUsage,
  voiceUsage,
  sharedUrl,
}: {
  importUsage: UsageDto | null;
  voiceUsage: UsageDto | null;
  sharedUrl?: string;
}) {
  const t = useTranslations("dishes.import");
  const tCommon = useTranslations("common");
  const [draft, setDraft] = useState<DishDraftDto | null>(null);
  const [version, setVersion] = useState(0);

  return (
    <div className="space-y-6">
      {draft ? (
        <Alert role="status">
          <InfoIcon aria-hidden="true" />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t("imported", { site: draft.source?.siteName ?? "" })}</span>
            {draft.source ? (
              <a
                href={draft.source.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 font-medium text-primary-strong underline-offset-4 hover:underline"
              >
                {t("viewSource")}
                <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                <span className="sr-only">({tCommon("opensInNewTab")})</span>
              </a>
            ) : null}
            <Button
              variant="link"
              className="h-auto px-0"
              onClick={() => {
                setDraft(null);
                setVersion((v) => v + 1);
              }}
            >
              {t("startOver")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ImportLinkCard
          usage={importUsage}
          initialUrl={sharedUrl}
          onImported={(next) => {
            setDraft(next);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {/* A new key re-starts the form from the imported draft (or empty after "Start over"). */}
      <DishForm key={version} draft={draft ?? undefined} voiceUsage={voiceUsage} />
    </div>
  );
}
