"use client";

import { LocateFixedIcon, MapPinOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ChipGroup } from "@/components/forms/chip-group";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DIETARY_TAGS, type DietaryTag } from "@/lib/dishes";

export type KitchenValues = {
  city: string;
  latitude: number | null;
  longitude: number | null;
  dietaryPrefs: DietaryTag[];
};

type Part = "city" | "diet";

/**
 * City (or the device's rough location) and dietary preferences: the same
 * fields in onboarding and Settings → Kitchen. Location comes from the
 * browser only; nothing is sent anywhere until the person saves.
 */
export function KitchenFields({
  values,
  onChange,
  parts = ["city", "diet"],
  cityError,
}: {
  values: KitchenValues;
  onChange: (values: KitchenValues) => void;
  parts?: Part[];
  cityError?: string | null;
}) {
  const t = useTranslations("onboarding.city");
  const tDiet = useTranslations("onboarding.diet");
  const tDishes = useTranslations("dishes");
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const hasLocation = values.latitude !== null && values.longitude !== null;

  function locate() {
    if (!("geolocation" in navigator)) return setProblem(t("unavailable"));
    setLocating(true);
    setProblem(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({ ...values, latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        setLocating(false);
        setProblem(error.code === error.PERMISSION_DENIED ? t("denied") : t("unavailable"));
      },
      // Rough is enough, and rough is faster and kinder to the battery.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 3_600_000 },
    );
  }

  return (
    <div className="space-y-6">
      {parts.includes("city") ? (
        <div className="space-y-3">
          <TextField
            label={t("label")}
            name="city"
            placeholder={t("placeholder")}
            maxLength={80}
            autoComplete="address-level2"
            value={values.city}
            // A typed city replaces a device location; the server looks the new city up on save.
            onChange={(e) => onChange({ ...values, city: e.target.value, latitude: null, longitude: null })}
            error={cityError}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={locate} disabled={locating}>
              {locating ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LocateFixedIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {locating ? t("locating") : t("useLocation")}
            </Button>
            {hasLocation ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange({ ...values, latitude: null, longitude: null })}
              >
                <MapPinOffIcon aria-hidden="true" data-icon="inline-start" />
                {t("clearLocation")}
              </Button>
            ) : null}
          </div>
          <p aria-live="polite" className="text-sm">
            {problem ? (
              <span className="text-destructive">{problem}</span>
            ) : hasLocation ? (
              <span className="text-primary-strong">{t("located")}</span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        </div>
      ) : null}
      {parts.includes("diet") ? (
        <ChipGroup
          label={tDishes("form.dietLabel")}
          hint={tDiet("body")}
          type="multiple"
          value={values.dietaryPrefs}
          onChange={(next) => onChange({ ...values, dietaryPrefs: DIETARY_TAGS.filter((d) => next.includes(d)) })}
          options={DIETARY_TAGS.map((d) => ({ value: d, label: tDishes(`diet.${d}`) }))}
        />
      ) : null}
    </div>
  );
}
