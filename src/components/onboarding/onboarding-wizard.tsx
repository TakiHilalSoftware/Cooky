"use client";

import { CheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { ChipGroup } from "@/components/forms/chip-group";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { KitchenFields, type KitchenValues } from "@/components/settings/kitchen-fields";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { checkFields } from "@/lib/forms";
import { HOME_AFTER_SIGN_IN } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { completeOnboarding, skipOnboarding, updateLocale } from "@/server/actions/settings";
import { DishCover } from "@/components/brand/dish-cover";
import type { CatalogCardDto } from "@/server/features/discover/dto";
import type { KitchenDto } from "@/server/features/profile/dto";
import { kitchenSchema } from "@/server/features/profile/schema";

const STEPS = ["language", "city", "diet", "staples", "favorites"] as const;
type Step = (typeof STEPS)[number];
/** PRD §3.1: at least three favorites to start with. */
const MIN_FAVORITES = 3;

type OnboardingWizardProps = {
  kitchen: KitchenDto;
  dishes: CatalogCardDto[];
  /** Everyday staples in the viewer's language, to tick as "always have". */
  staples: string[];
  /** From ?step=, so changing language (which reloads the page) keeps the place. */
  initialStep: number;
};

/** The starter pack (PRD §3.1): language, city, diet, staples, favorite dishes. Every step can be skipped. */
export function OnboardingWizard({ kitchen, dishes, staples, initialStep }: OnboardingWizardProps) {
  const t = useTranslations("onboarding");
  const tLanguage = useTranslations("language");
  const messages = useFormMessages();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [values, setValues] = useState<KitchenValues>({
    city: kitchen.city ?? "",
    latitude: kitchen.latitude,
    longitude: kitchen.longitude,
    dietaryPrefs: kitchen.dietaryPrefs,
    mealTimes: kitchen.mealTimes,
  });
  const [cityError, setCityError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedStaples, setPickedStaples] = useState<string[]>([]);
  const finish = useAction(completeOnboarding);
  const skip = useAction(skipOnboarding);
  const setLocale = useAction(updateLocale);
  const step: Step = STEPS[index]!;
  const busy = finish.isPending || skip.isPending;

  async function chooseLanguage(next: AppLocale) {
    if (next !== locale) await setLocale.executeAsync({ locale: next });
    // The whole page changes language; carry on at the next step.
    router.replace(`${pathname}?step=1`, { locale: next });
    if (next === locale) setIndex(1);
  }

  function goNext() {
    if (step === "city") {
      const check = checkFields(kitchenSchema, { ...values });
      if (!check.ok && check.errors.city) return setCityError(messages.field(check.errors.city));
      setCityError(null);
    }
    if (index < STEPS.length - 1) setIndex(index + 1);
  }

  async function onFinish(favorites: string[]) {
    const result = await finish.executeAsync({ ...values, locale, favorites, staples: pickedStaples });
    if (!result.data) return toast.error(messages.action(result.serverError));
    toast.success(t("welcome", { count: result.data.saved }));
    router.push(HOME_AFTER_SIGN_IN);
  }

  async function onSkipAll() {
    const result = await skip.executeAsync();
    if (result.serverError) return toast.error(messages.action(result.serverError));
    router.push(HOME_AFTER_SIGN_IN);
  }

  const toggle = (slug: string) =>
    setPicked((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-primary-strong">
            {t("progress", { step: index + 1, total: STEPS.length })}
          </p>
          <Button variant="ghost" onClick={onSkipAll} disabled={busy}>
            {t("skipAll")}
          </Button>
        </div>
        <Progress
          value={((index + 1) / STEPS.length) * 100}
          aria-label={t("progress", { step: index + 1, total: STEPS.length })}
          className="h-2"
        />
      </div>

      <section
        aria-labelledby="onboarding-step"
        className="space-y-6 rounded-3xl border border-border bg-card p-5 sm:p-8"
      >
        <div className="space-y-2">
          <h1 id="onboarding-step" className="font-heading text-3xl text-balance sm:text-4xl">
            {t(`${step}.heading`)}
          </h1>
          <p className="text-pretty text-muted-foreground">{t(`${step}.body`)}</p>
        </div>

        {step === "language" ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {routing.locales.map((l) => (
              <li key={l}>
                <Button
                  variant={l === locale ? "default" : "outline"}
                  size="lg"
                  className="h-auto min-h-14 w-full justify-between text-lg"
                  lang={l}
                  aria-pressed={l === locale}
                  disabled={setLocale.isPending}
                  onClick={() => chooseLanguage(l)}
                >
                  {tLanguage(`names.${l}`)}
                  {l === locale ? <CheckIcon aria-hidden="true" /> : null}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {step === "city" ? (
          <KitchenFields values={values} onChange={setValues} parts={["city"]} cityError={cityError} />
        ) : null}
        {step === "diet" ? <KitchenFields values={values} onChange={setValues} parts={["diet"]} /> : null}

        {step === "staples" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p aria-live="polite" className="text-sm font-medium">
                {t("staples.picked", { count: pickedStaples.length })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickedStaples(pickedStaples.length === staples.length ? [] : staples)}
              >
                {pickedStaples.length === staples.length ? t("staples.none") : t("staples.all")}
              </Button>
            </div>
            <ChipGroup
              label={t("staples.label")}
              type="multiple"
              value={pickedStaples}
              onChange={(next) => setPickedStaples(staples.filter((s) => next.includes(s)))}
              options={staples.map((s) => ({ value: s, label: s }))}
            />
          </div>
        ) : null}

        {step === "favorites" ? (
          <div className="space-y-4">
            <p aria-live="polite" className="text-sm font-medium">
              {picked.length >= MIN_FAVORITES
                ? t("favorites.enough", { count: picked.length })
                : t("favorites.picked", { count: picked.length })}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {dishes.map((dish) => {
                const on = picked.includes(dish.slug);
                return (
                  <li key={dish.slug}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(dish.slug)}
                      className={cn(
                        "flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors",
                        on ? "border-primary-strong bg-secondary" : "border-border hover:border-primary-strong",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border",
                          on ? "border-primary-strong bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {on ? <CheckIcon className="size-4" /> : null}
                      </span>
                      <DishCover photoUrl={dish.photoUrl} course={dish.course} seed={dish.slug} shape="thumb" />
                      <span className="min-w-0">
                        <span className="block font-medium">{dish.name}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{dish.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="lg" onClick={() => setIndex(index - 1)} disabled={index === 0 || busy}>
          {t("back")}
        </Button>
        <div className="flex flex-wrap gap-2">
          {step !== "language" ? (
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => (step === "favorites" ? onFinish([]) : setIndex(index + 1))}
            >
              {t("skipStep")}
            </Button>
          ) : null}
          {step === "favorites" ? (
            <Button size="lg" disabled={busy || picked.length < MIN_FAVORITES} onClick={() => onFinish(picked)}>
              {finish.isPending ? <Spinner data-icon="inline-start" /> : null}
              {finish.isPending ? t("finishing") : t("finish")}
            </Button>
          ) : step !== "language" ? (
            <Button size="lg" onClick={goNext}>
              {t("next")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
