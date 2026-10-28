"use client";

import { BookmarkCheckIcon, BookmarkPlusIcon, CheckCircle2Icon, NotebookPenIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useLogCook } from "@/components/cook/use-log-cook";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { saveCatalogDish } from "@/server/actions/discover";
import type { AssistantPickDto } from "@/server/features/assistant/dto";

/** A dish under an Assistant reply: always a real one (the server drops anything invented). */
export function PickCard({ pick }: { pick: AssistantPickDto }) {
  const t = useTranslations("assistant");
  const tCook = useTranslations("cook");
  const locale = useLocale();
  const onActionError = useActionErrorHandler();
  const { log, pending } = useLogCook();
  const [saved, setSaved] = useState(pick.kind === "discover" && pick.saved);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (pick.kind !== "discover") return;
    setSaving(true);
    const result = await saveCatalogDish({ slug: pick.slug, locale: locale as "en" | "fr" | "ar" });
    setSaving(false);
    if (result?.data) {
      setSaved(true);
      toast.success(t("savedToDishes", { name: pick.name }));
    } else onActionError(result?.serverError, "dishes");
  }

  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-background p-3">
      {pick.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pick.photoUrl}
          alt=""
          width={96}
          height={72}
          className="hidden aspect-[4/3] w-24 shrink-0 rounded-xl bg-muted object-cover sm:block"
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-medium text-primary-strong">
          {pick.kind === "mine" ? t("fromYourDishes") : t("fromDiscover")}
        </p>
        <p className="font-heading text-lg leading-snug break-words">
          <Link
            href={pick.kind === "mine" ? `/dishes/${pick.dishId}` : `/discover/${pick.slug}`}
            className="underline-offset-4 hover:underline"
          >
            {pick.name}
          </Link>
        </p>
        <p className="text-sm text-pretty">{pick.why}</p>
        {pick.kind === "mine" ? (
          pick.missing.length === 0 ? (
            <p className="flex items-center gap-1 text-sm font-medium text-primary-strong">
              <CheckCircle2Icon aria-hidden="true" className="size-4" />
              {tCook("ready")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tCook("missingCount", { count: pick.missing.length })} {pick.missing.join(tCook("listSeparator"))}
            </p>
          )
        ) : (
          <p className="line-clamp-2 text-sm text-muted-foreground">{pick.description}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {pick.kind === "mine" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending !== null}
              onClick={() => log({ id: pick.dishId, name: pick.name }, { source: "assistant" })}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <NotebookPenIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {t("cookToday")}
            </Button>
          ) : saved ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <BookmarkCheckIcon aria-hidden="true" className="size-4" />
              {t("inYourDishes")}
            </p>
          ) : (
            <Button size="sm" variant="outline" disabled={saving} onClick={save}>
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <BookmarkPlusIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {t("saveRecipe")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
