"use client";

import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DISH_BOUNDS } from "@/lib/dishes";
import { checkFields } from "@/lib/forms";
import { saveDishNote } from "@/server/actions/dishes";
import { dishNoteSchema } from "@/server/features/dishes/schema";

/** The private "my notes" field on a dish (PRD §3.2). Works even when the box is read-only. */
export function DishNoteCard({ dishId, note }: { dishId: string; note: string | null }) {
  const t = useTranslations("dishes.note");
  const messages = useFormMessages();
  const id = useId();
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useAction(saveDishNote);
  const unchanged = text.trim() === (note ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(dishNoteSchema, { dishId, text });
    if (!check.ok) return setError(messages.field(check.errors.text));
    setError(null);
    const result = await save.executeAsync(check.data);
    if (result.data) toast.success(result.data.text ? t("saved") : t("cleared"));
    else toast.error(messages.action(result.serverError));
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 id={`${id}-heading`} className="font-heading text-xl">
        {t("heading")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      <form noValidate onSubmit={onSubmit} className="mt-4 space-y-3">
        <label htmlFor={id} className="sr-only">
          {t("label")}
        </label>
        <Textarea
          id={id}
          name="text"
          rows={3}
          maxLength={DISH_BOUNDS.noteMax}
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" disabled={unchanged || save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          {save.isPending ? t("saving") : t("save")}
        </Button>
      </form>
    </section>
  );
}
