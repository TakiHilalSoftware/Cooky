"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  BookPlusIcon,
  CheckCircle2Icon,
  ChefHatIcon,
  CircleHelpIcon,
  CompassIcon,
  ListPlusIcon,
  PlusIcon,
  RefreshCwIcon,
  UtensilsIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { DishCover } from "@/components/brand/dish-cover";
import { EmptyState } from "@/components/feedback/empty-state";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { errorCode, unwrap } from "@/components/query/action-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Link, useRouter } from "@/i18n/navigation";
import { addShoppingItem } from "@/server/actions/shopping";
import type { ReadyDishDto, ReadyToCookDto } from "@/server/features/cook/dto";

import { useReadyToCook } from "./use-kitchen";

type ReadyToCookPanelProps = {
  initial: ReadyToCookDto;
  /** "I have it": adds one missing ingredient to My kitchen (the panel then updates itself). */
  onHave: (name: string) => void;
};

/**
 * My kitchen's "Ready to cook": which dishes the kitchen covers right now, and
 * which are one or two ingredients short, with a one-tap way to close the gap.
 * It refreshes itself after every kitchen change, without reloading the page.
 */
export function ReadyToCookPanel({ initial, onHave }: ReadyToCookPanelProps) {
  const t = useTranslations("kitchen.readyPanel");
  const { data, isFetching, isError, refetch } = useReadyToCook(initial);
  const hidden = data.readyCount - data.ready.length + (data.almostCount - data.almost.length);

  return (
    <section
      aria-labelledby="ready-heading"
      aria-busy={isFetching}
      className="space-y-5 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1">
            <h2 id="ready-heading" className="font-heading text-2xl">
              {t("heading")}
            </h2>
            <HowItWorks />
          </div>
          <p className="text-sm text-pretty text-muted-foreground">{t("hint")}</p>
        </div>
        <FreshnessNote fetching={isFetching} failed={isError} onRetry={() => void refetch()} />
      </div>

      {data.total === 0 ? (
        <EmptyState
          headingLevel={3}
          className="border-0 p-0"
          illustration={<BookPlusIcon aria-hidden="true" className="size-12 text-primary-strong" />}
          title={t("emptyBoxTitle")}
          description={t("emptyBoxBody")}
          action={
            <>
              <Button asChild>
                <Link href="/dishes/new">
                  <PlusIcon aria-hidden="true" data-icon="inline-start" />
                  {t("addDish")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/discover">
                  <CompassIcon aria-hidden="true" data-icon="inline-start" />
                  {t("browseDiscover")}
                </Link>
              </Button>
            </>
          }
        />
      ) : data.readyCount === 0 && data.almostCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center">
          <UtensilsIcon aria-hidden="true" className="mx-auto mb-2 size-8 text-muted-foreground" />
          <h3 className="font-medium">{t("nothingTitle")}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-muted-foreground">{t("nothingBody")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.readyCount > 0 ? (
            <DishGroup title={t("readyNow", { count: data.readyCount })} dishes={data.ready} onHave={onHave} />
          ) : null}
          {data.almostCount > 0 ? (
            <DishGroup
              title={t("almost", { count: data.almostCount })}
              hint={t("almostHint")}
              dishes={data.almost}
              onHave={onHave}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            {hidden > 0 ? <p className="text-sm text-muted-foreground">{t("more", { count: hidden })}</p> : <span />}
            <Button asChild variant="link" className="px-0">
              <Link href="/cook">
                {t("seeAll")}
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" className="rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** A tap-friendly explanation (tooltips don't open on touch screens). */
function HowItWorks() {
  const t = useTranslations("kitchen.readyPanel");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" aria-label={t("howItWorks")}>
          <CircleHelpIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs text-sm text-pretty">
        <p className="mb-1 font-medium">{t("howItWorks")}</p>
        <p className="text-muted-foreground">{t("howItWorksBody")}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Says when the list is being refreshed, or that it couldn't be (with a retry); otherwise nothing. */
function FreshnessNote({ fetching, failed, onRetry }: { fetching: boolean; failed: boolean; onRetry: () => void }) {
  const t = useTranslations("kitchen.readyPanel");
  const tCommon = useTranslations("common");
  return (
    <div aria-live="polite" className="flex min-h-11 items-center">
      {fetching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" />
          {t("updating")}
        </p>
      ) : failed ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          <p>{t("updateFailed")}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
            {tCommon("tryAgain")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DishGroup({
  title,
  hint,
  dishes,
  onHave,
}: {
  title: string;
  hint?: string;
  dishes: ReadyDishDto[];
  onHave: (name: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <ul className="grid gap-3 @xl:grid-cols-2">
        {dishes.map((dish) => (
          <ReadyDish key={dish.id} dish={dish} onHave={onHave} />
        ))}
      </ul>
    </div>
  );
}

function ReadyDish({ dish, onHave }: { dish: ReadyDishDto; onHave: (name: string) => void }) {
  const t = useTranslations("kitchen.readyPanel");
  const tCook = useTranslations("cook");
  const tDishes = useTranslations("dishes");
  const ready = dish.missing.length === 0;

  return (
    <li className="flex gap-3 rounded-2xl border border-border p-3">
      <DishCover photoUrl={dish.photoUrl} course={dish.course} seed={dish.id} shape="thumb" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-primary-strong">{tDishes(`course.${dish.course}`)}</p>
          <Link
            href={`/dishes/${dish.id}`}
            className="font-medium break-words underline-offset-4 hover:underline"
            title={dish.name}
          >
            {dish.name}
          </Link>
        </div>
        {ready ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex items-center gap-1 text-sm font-medium text-primary-strong">
              <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0" />
              {tCook("ready")}
            </p>
            <Button asChild size="sm" className="ms-auto" title={t("cookHint", { name: dish.name })}>
              <Link href={`/dishes/${dish.id}/cook`}>
                <ChefHatIcon aria-hidden="true" data-icon="inline-start" />
                {t("cook")}
                <span className="sr-only">: {dish.name}</span>
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">
                {t("missing", { items: dish.missing.join(tCook("listSeparator")) })}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {dish.missing.map((name) => (
                <Button
                  key={name}
                  size="sm"
                  variant="outline"
                  title={t("iHaveItHint", { name })}
                  onClick={() => onHave(name)}
                >
                  <CheckCircle2Icon aria-hidden="true" data-icon="inline-start" />
                  <span className="max-w-32 truncate">{t("iHaveIt", { name })}</span>
                </Button>
              ))}
              <AddToListButton names={dish.missing} />
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/** Puts a dish's missing ingredients on the shopping list, with a way to go there. */
function AddToListButton({ names }: { names: string[] }) {
  const t = useTranslations("kitchen.readyPanel");
  const tKitchen = useTranslations("kitchen");
  const messages = useFormMessages();
  const online = useOnline();
  const router = useRouter();
  const tCook = useTranslations("cook");
  const items = names.join(tCook("listSeparator"));

  const { mutate, isPending } = useMutation({
    // One item per call: the list merges each into what's already there.
    mutationFn: async () => {
      for (const name of names) unwrap(await addShoppingItem({ name }));
      return names.length;
    },
    onSuccess: (count) =>
      toast.success(t("addedToList", { count }), {
        action: { label: t("viewList"), onClick: () => router.push("/shopping") },
      }),
    onError: (error) => toast.error(messages.action(errorCode(error))),
  });

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={isPending}
      title={t("addToListHint", { items })}
      onClick={() => (online ? mutate() : toast.error(tKitchen("offline")))}
    >
      {isPending ? <Spinner data-icon="inline-start" /> : <ListPlusIcon aria-hidden="true" data-icon="inline-start" />}
      {t("addToList")}
      <span className="sr-only">: {items}</span>
    </Button>
  );
}
