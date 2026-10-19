"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { TriesMeter } from "@/components/paywall/tries-meter";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAudioRecorder } from "@/components/voice/use-audio-recorder";
import { dictateIngredients } from "@/server/actions/voice";
import type { UsageDto } from "@/server/features/billing/dto";
import type { IngredientDto } from "@/server/features/dishes/dto";

/**
 * "Dictate ingredients" (uses a voice try): speak a list, get rows. Every
 * failure says what happened and what to do; typing always stays possible.
 */
export function VoiceDictation({
  usage,
  onIngredients,
}: {
  usage?: UsageDto | null;
  onIngredients: (rows: IngredientDto[]) => void;
}) {
  const t = useTranslations("dishes.voice");
  const locale = useLocale();
  const onActionError = useActionErrorHandler();
  const [working, setWorking] = useState(false);
  const recorder = useAudioRecorder(send);
  const { state } = recorder;

  async function send(audio: Blob) {
    setWorking(true);
    const form = new FormData();
    form.append("audio", audio);
    form.append("locale", locale);
    const result = await dictateIngredients(form);
    setWorking(false);
    if (result?.data) {
      onIngredients(result.data.ingredients);
      toast.success(t("added", { count: result.data.ingredients.length }));
      return;
    }
    const code = result?.serverError;
    if (code === "quota_exceeded" || code === "plan_required") return onActionError(code, "voice");
    recorder.fail(code === "not_found" ? "nothingHeard" : "unavailable");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {state.kind === "recording" ? (
          <Button type="button" variant="destructive" onClick={recorder.stop}>
            <SquareIcon aria-hidden="true" data-icon="inline-start" />
            {t("stop")}
            <span className="tabular-nums">0:{String(state.seconds).padStart(2, "0")}</span>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={recorder.start} disabled={working}>
            {working ? <Spinner data-icon="inline-start" /> : <MicIcon aria-hidden="true" data-icon="inline-start" />}
            {working ? t("working") : t("button")}
          </Button>
        )}
        {usage ? <TriesMeter usage={usage} variant="compact" /> : null}
      </div>
      <p aria-live="polite" className="text-sm">
        {state.kind === "recording" ? (
          <span className="flex items-center gap-2 text-primary-strong">
            <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-destructive" />
            {t("listening")}
          </span>
        ) : state.kind === "error" ? (
          <span className="text-destructive">{t(`errors.${state.problem}`)}</span>
        ) : (
          <span className="text-muted-foreground">{t("hint")}</span>
        )}
      </p>
    </div>
  );
}
