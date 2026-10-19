"use client";

import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { rateDish } from "@/server/actions/cook";

/** 1–5 stars and an optional review (PRD §3.2). Shown once the dish has been cooked. */
export function RatingForm({
  dishId,
  initial,
  onSaved,
}: {
  dishId: string;
  initial: { stars: number; review: string | null } | null;
  onSaved?: () => void;
}) {
  const t = useTranslations("rating");
  const messages = useFormMessages();
  const groupId = useId();
  const reviewId = useId();
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [review, setReview] = useState(initial?.review ?? "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (stars === 0) return toast.error(t("pickStars"));
    setSaving(true);
    const result = await rateDish({ dishId, stars, review });
    setSaving(false);
    if (!result?.data) return toast.error(messages.action(result?.serverError));
    toast.success(t("saved"));
    onSaved?.();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend id={groupId} className="text-sm font-medium">
          {t("starsLabel")}
        </legend>
        <div role="radiogroup" aria-labelledby={groupId} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={t("stars", { count: value })}
              onClick={() => setStars(value)}
              className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <StarIcon
                aria-hidden="true"
                className={cn("size-7", value <= stars ? "fill-primary text-primary-strong" : "text-muted-foreground")}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={reviewId}>{t("reviewLabel")}</Label>
        <Textarea
          id={reviewId}
          value={review}
          maxLength={1000}
          placeholder={t("reviewPlaceholder")}
          onChange={(e) => setReview(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? <Spinner data-icon="inline-start" /> : null}
        {initial ? t("update") : t("save")}
      </Button>
    </form>
  );
}
