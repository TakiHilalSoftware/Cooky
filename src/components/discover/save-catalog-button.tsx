"use client";

import { BookmarkCheckIcon, BookmarkPlusIcon, LogInIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { saveCatalogDish } from "@/server/actions/discover";

type SaveCatalogButtonProps = {
  slug: string;
  name: string;
  signedIn: boolean;
  /** The viewer's copy, when they already saved it. */
  savedDishId: string | null;
};

/** "Save to my dishes": log in first when signed out; "Open my copy" once saved; a full box opens the upgrade sheet. */
export function SaveCatalogButton({ slug, name, signedIn, savedDishId }: SaveCatalogButtonProps) {
  const t = useTranslations("discover");
  const locale = useLocale();
  const router = useRouter();
  const onActionError = useActionErrorHandler();
  const save = useAction(saveCatalogDish);

  if (!signedIn) {
    return (
      <Button asChild size="lg">
        <Link href={`/login?next=${encodeURIComponent(`/discover/${slug}`)}`}>
          <LogInIcon aria-hidden="true" data-icon="inline-start" />
          {t("logInToSave")}
        </Link>
      </Button>
    );
  }
  if (savedDishId) {
    return (
      <Button asChild size="lg" variant="outline">
        <Link href={`/dishes/${savedDishId}`}>
          <BookmarkCheckIcon aria-hidden="true" data-icon="inline-start" />
          {t("openCopy")}
        </Link>
      </Button>
    );
  }

  async function onSave() {
    const result = await save.executeAsync({ slug, locale });
    if (result.data) {
      toast.success(t("savedToast", { name }));
      router.refresh();
    } else onActionError(result.serverError, "dishes");
  }

  return (
    <Button size="lg" onClick={onSave} disabled={save.isPending} aria-label={t("saveLabel", { name })}>
      {save.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <BookmarkPlusIcon aria-hidden="true" data-icon="inline-start" />
      )}
      {save.isPending ? t("saving") : t("save")}
    </Button>
  );
}
