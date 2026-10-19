import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import type { UsageDto } from "@/server/features/billing/dto";
import type { DishFormDto } from "@/server/features/dishes/dto";
import type { PhotoSlotDto } from "@/server/features/photos/dto";

import { DishForm } from "./dish-form";
import { DishPhotoCard } from "./dish-photo-card";

/** The frame around the dish form: where you came from, and what you're doing. */
export function DishFormPage({
  dish,
  voiceUsage,
  photo,
  children,
}: {
  dish?: DishFormDto;
  /** Editing only: a new dish gets its photo once it exists. */
  photo?: PhotoSlotDto | null;
  voiceUsage?: UsageDto | null;
  children?: ReactNode;
}) {
  const t = useTranslations("dishes");
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-10">
      <Link
        href={dish ? `/dishes/${dish.id}` : "/dishes"}
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {dish ? dish.name : t("page.back")}
      </Link>
      <h1 className="font-heading text-4xl text-balance break-words">
        {dish ? t("form.editTitle", { name: dish.name }) : t("form.newTitle")}
      </h1>
      {dish && photo ? <DishPhotoCard dishId={dish.id} name={dish.name} slot={photo} /> : null}
      {children ?? <DishForm dish={dish} voiceUsage={voiceUsage} />}
    </div>
  );
}
