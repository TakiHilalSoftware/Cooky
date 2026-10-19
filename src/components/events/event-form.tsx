"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { checkFields } from "@/lib/forms";
import { EVENT_BOUNDS, eventFieldsSchema } from "@/server/features/events/schema";

export type EventValues = { name: string; date: string; guests: number };

/** Name, date and guests: the same fields to create an event and to edit one. */
export function EventForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: EventValues;
  submitLabel: string;
  onSubmit: (values: EventValues) => Promise<void>;
}) {
  const t = useTranslations("events");
  const messages = useFormMessages();
  const [values, setValues] = useState({ ...initial, guests: String(initial.guests) });
  const [errors, setErrors] = useState<Partial<Record<keyof EventValues, string | null>>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(eventFieldsSchema, values);
    if (!check.ok) {
      return setErrors({
        name: messages.field(check.errors.name),
        date: messages.field(check.errors.date),
        guests: messages.field(check.errors.guests),
      });
    }
    setErrors({});
    setSaving(true);
    await onSubmit(check.data);
    setSaving(false);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <TextField
        label={t("nameLabel")}
        name="name"
        maxLength={EVENT_BOUNDS.nameMax}
        placeholder={t("namePlaceholder")}
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        error={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("dateLabel")}
          name="date"
          type="date"
          value={values.date}
          onChange={(e) => setValues({ ...values, date: e.target.value })}
          error={errors.date}
        />
        <TextField
          label={t("guestsLabel")}
          hint={t("guestsHint")}
          name="guests"
          type="number"
          inputMode="numeric"
          min={EVENT_BOUNDS.guestsMin}
          max={EVENT_BOUNDS.guestsMax}
          value={values.guests}
          onChange={(e) => setValues({ ...values, guests: e.target.value })}
          error={errors.guests}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? <Spinner data-icon="inline-start" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
