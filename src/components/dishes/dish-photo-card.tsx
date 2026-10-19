"use client";

import { useTranslations } from "next-intl";

import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { removeDishPhoto, uploadDishPhoto } from "@/server/actions/photos";
import type { PhotoSlotDto } from "@/server/features/photos/dto";

/** The photo on the edit page. It saves on its own, separately from the form's Save. */
export function DishPhotoCard({ dishId, name, slot }: { dishId: string; name: string; slot: PhotoSlotDto }) {
  const t = useTranslations("photos");
  const onActionError = useActionErrorHandler();
  return (
    <section aria-labelledby="dish-photo" className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="dish-photo" className="font-heading text-2xl">
          {t("dishHeading")}
        </h2>
        {slot.enabled ? <p className="text-sm text-muted-foreground">{t("dishDescription")}</p> : null}
      </div>
      <PhotoPicker
        photo={slot.photo}
        enabled={slot.enabled}
        shape="wide"
        alt={name}
        upload={(file) => {
          const form = new FormData();
          form.append("dishId", dishId);
          form.append("photo", file);
          return uploadDishPhoto(form);
        }}
        remove={() => removeDishPhoto({ id: dishId })}
        onQuotaExceeded={() => onActionError("quota_exceeded", "dishes")}
      />
    </section>
  );
}
