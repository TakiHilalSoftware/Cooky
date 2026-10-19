"use client";

import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { checkFields } from "@/lib/forms";
import { ONBOARDING_PATH } from "@/lib/routes";
import { updateKitchen } from "@/server/actions/settings";
import type { KitchenDto } from "@/server/features/profile/dto";
import { kitchenSchema } from "@/server/features/profile/schema";

import { KitchenFields, type KitchenValues } from "./kitchen-fields";
import { SettingsSection } from "./settings-section";

/** Settings → Kitchen: city or rough location, and dietary preferences. */
export function KitchenCard({ kitchen }: { kitchen: KitchenDto }) {
  const t = useTranslations("settings.kitchen");
  const messages = useFormMessages();
  const [values, setValues] = useState<KitchenValues>({
    city: kitchen.city ?? "",
    latitude: kitchen.latitude,
    longitude: kitchen.longitude,
    dietaryPrefs: kitchen.dietaryPrefs,
  });
  const [cityError, setCityError] = useState<string | null>(null);
  const save = useAction(updateKitchen);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(kitchenSchema, values);
    if (!check.ok) return setCityError(messages.field(check.errors.city));
    setCityError(null);
    const result = await save.executeAsync(check.data);
    if (!result.data) return toast.error(messages.action(result.serverError));
    const saved = result.data;
    setValues((current) => ({ ...current, latitude: saved.latitude, longitude: saved.longitude }));
    // Saved either way; an unknown city just can't give the weather yet.
    if (saved.city && saved.latitude === null) toast.warning(t("cityNotFound", { city: saved.city }));
    else toast.success(t("saved"));
  }

  return (
    <SettingsSection title={t("heading")} description={t("description")}>
      <form noValidate onSubmit={onSubmit} className="space-y-6">
        <KitchenFields values={values} onChange={setValues} cityError={cityError} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner data-icon="inline-start" /> : null}
            {save.isPending ? t("saving") : t("save")}
          </Button>
          <Link
            href={ONBOARDING_PATH}
            className="text-sm font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            {t("setup")}
          </Link>
        </div>
      </form>
    </SettingsSection>
  );
}
