"use client";

import { LinkIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type FormEvent } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { TriesMeter } from "@/components/paywall/tries-meter";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { importFromUrl } from "@/server/actions/import";
import type { UsageDto } from "@/server/features/billing/dto";
import type { DishDraftDto } from "@/server/features/dishes/dto";

type ImportLinkCardProps = {
  usage: UsageDto | null;
  /** A link shared to Cooky (PWA share target), ready to import. */
  initialUrl?: string;
  onImported: (draft: DishDraftDto) => void;
};

/** "Import from a link" (uses an import try; given back if the page can't be read). */
export function ImportLinkCard({ usage, initialUrl = "", onImported }: ImportLinkCardProps) {
  const t = useTranslations("dishes.import");
  const locale = useLocale();
  const id = useId();
  const onActionError = useActionErrorHandler();
  const [url, setUrl] = useState(initialUrl);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useAction(importFromUrl);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return setProblem(t("errors.invalid"));
    setProblem(null);
    const result = await run.executeAsync({ url, locale });
    if (result.data) return onImported(result.data);
    const code = result.serverError;
    if (code === "quota_exceeded" || code === "plan_required") return onActionError(code, "import");
    setProblem(
      code === "invalid" ? t("errors.invalid") : code === "not_found" ? t("errors.not_found") : t("errors.unavailable"),
    );
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="space-y-3 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 id={`${id}-heading`} className="font-heading text-xl">
            {t("heading")}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{t("body")}</p>
        </div>
        {usage ? <TriesMeter usage={usage} variant="compact" /> : null}
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <label htmlFor={id} className="sr-only">
          {t("label")}
        </label>
        <Input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder={t("placeholder")}
          value={url}
          maxLength={2000}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 basis-64"
          aria-invalid={problem ? true : undefined}
        />
        <Button type="submit" disabled={run.isPending}>
          {run.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <LinkIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {run.isPending ? t("importing") : t("button")}
        </Button>
      </form>
      {problem ? <FormAlert tone="error">{problem}</FormAlert> : null}
    </section>
  );
}
