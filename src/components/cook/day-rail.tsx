import { Clock3Icon, Undo2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { MealSlot } from "@/lib/dishes";
import { MINUTES_PER_DAY } from "@/lib/meal-times";
import { cn } from "@/lib/utils";
import type { CookMealDto } from "@/server/features/cook/dto";

type Href = ComponentProps<typeof Link>["href"];

/**
 * Where "now" sits on the rail, in % of its width. Stops are evenly spaced
 * (the centres of equal columns), so the marker moves proportionally within
 * the stretch between the two meals around it; midnight is at either end.
 */
export function railOffset(now: number, stops: number[]): number {
  const anchors = [
    { at: 0, pct: 0 },
    ...stops.map((at, i) => ({ at, pct: ((i + 0.5) / stops.length) * 100 })),
    { at: MINUTES_PER_DAY, pct: 100 },
  ];
  for (let i = 1; i < anchors.length; i++) {
    const from = anchors[i - 1]!;
    const to = anchors[i]!;
    if (now <= to.at)
      return to.at === from.at ? to.pct : from.pct + ((now - from.at) / (to.at - from.at)) * (to.pct - from.pct);
  }
  return 100;
}

/**
 * The day rail on Cook: the person's meals as stops along their day, where
 * they are now, and the meal the dishes below are for. Each stop shows that
 * meal's dishes instead; the times come from Settings → Kitchen.
 */
export function DayRail({ meal, hrefFor }: { meal: CookMealDto; hrefFor: (slot: MealSlot | null) => Href }) {
  const t = useTranslations("cook.meal");
  const tSlot = useTranslations("planner.slots");
  const tMeal = useTranslations("cook.meal.names");
  const format = useFormatter();

  /** A time of day in the viewer's 12/24-hour habit, independent of any zone. */
  const clock = (minutes: number) =>
    format.dateTime(new Date(Date.UTC(2000, 0, 1, 0, minutes)), {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  const duration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const parts = [
      hours > 0 ? format.number(hours, { style: "unit", unit: "hour", unitDisplay: "short" }) : null,
      rest > 0 || hours === 0 ? format.number(rest, { style: "unit", unit: "minute", unitDisplay: "short" }) : null,
    ].filter((part): part is string => part !== null);
    return format.list(parts, { type: "unit", style: "narrow" });
  };

  const name = tSlot(meal.slot);
  const time = clock(meal.at);
  const now = railOffset(
    meal.now,
    meal.day.map((d) => d.at),
  );
  // The caption stays inside the card at either end of the day.
  const caption = Math.min(Math.max(now, 8), 92);

  return (
    <section aria-labelledby="cook-meal" className="space-y-5 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72 space-y-1.5">
          <h2 id="cook-meal" className="font-heading text-2xl text-balance sm:text-3xl">
            {t(`heading.${meal.when}`, { meal: name, time })}
          </h2>
          <p className="text-sm font-medium text-primary-strong">
            {meal.when === "now" ? t("started", { time }) : t("startsIn", { duration: duration(meal.inMinutes) })}
          </p>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {meal.plannedCount > 0 ? `${t("planned", { count: meal.plannedCount })} ` : null}
            {t(meal.usualCount > 0 ? "usual" : "learn", { after: meal.plannedCount > 0 ? "planned" : "none" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {meal.picked ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={hrefFor(null)} scroll={false} title={t("backHint")}>
                <Undo2Icon aria-hidden="true" data-icon="inline-start" className="rtl:-scale-x-100" />
                {t("back")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings#meal-times" title={t("settingsHint")}>
              <Clock3Icon aria-hidden="true" data-icon="inline-start" />
              {t("settings")}
            </Link>
          </Button>
        </div>
      </div>

      <nav aria-label={t("railLabel")}>
        {/* "Now", above the line so it never sits on a meal's label. */}
        <div aria-hidden="true" className="relative mb-1 h-5">
          <span
            className="absolute top-0 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums rtl:translate-x-1/2"
            style={{ insetInlineStart: `${caption}%` }}
          >
            {t("now", { time: clock(meal.now) })}
          </span>
        </div>
        <div className="relative">
          <div aria-hidden="true" className="absolute inset-x-0 top-[7px] h-0.5 rounded-full bg-border" />
          <div
            aria-hidden="true"
            className="absolute start-0 top-[7px] h-0.5 rounded-full bg-primary/70"
            style={{ width: `${now}%` }}
          />
          <div
            aria-hidden="true"
            className="absolute -top-0.5 h-5 w-0.5 -translate-x-1/2 rounded-full bg-foreground rtl:translate-x-1/2"
            style={{ insetInlineStart: `${now}%` }}
          />
          <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${meal.day.length}, minmax(0, 1fr))` }}>
            {meal.day.map((stop) => {
              const current = stop.slot === meal.slot;
              const stopName = tSlot(stop.slot);
              const inSentence = tMeal(stop.slot);
              return (
                <li key={stop.slot} className="flex justify-center">
                  <Link
                    href={hrefFor(stop.slot)}
                    scroll={false}
                    aria-current={current ? "true" : undefined}
                    title={
                      current
                        ? t("stopShown", { meal: inSentence })
                        : stop.passed
                          ? t("stopPassed", { meal: inSentence })
                          : t("stopShow", { meal: inSentence })
                    }
                    className="group flex min-h-11 w-full flex-col items-center gap-1.5 rounded-xl px-1 pb-1.5 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="relative flex size-4 items-center justify-center">
                      {current && meal.when === "now" ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "relative size-4 rounded-full border-2 transition-transform group-hover:scale-110",
                          current
                            ? "border-primary bg-primary ring-4 ring-primary/20"
                            : stop.passed
                              ? "border-muted-foreground/40 bg-muted"
                              : "border-primary bg-card",
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "max-w-full text-xs break-words sm:text-sm",
                        current ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {stopName}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{clock(stop.at)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </section>
  );
}
