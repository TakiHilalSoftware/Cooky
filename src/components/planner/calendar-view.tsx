"use client";

import {
  CalendarDaysIcon,
  ChefHatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/components/feedback/icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { addMonths } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { undoLogCook } from "@/server/actions/cook";
import {
  addPlannedMeal,
  moveCookLog,
  movePlannedMeal,
  removePlannedMeal,
  restoreCookLog,
} from "@/server/actions/planner";
import type { CalendarDto, CalendarEntryDto } from "@/server/features/planner/dto";

type MealEntry = Exclude<CalendarEntryDto, { kind: "event" }>;
const isMeal = (entry: CalendarEntryDto): entry is MealEntry => entry.kind !== "event";

import { usePlannerWrite } from "./use-planner-actions";

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * The calendar (PRD §3.5): a month of planned and cooked meals. Tap a day to
 * see its meals; each can move to another date or be removed (with Undo).
 */
export function CalendarView({ calendar }: { calendar: CalendarDto }) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const write = usePlannerWrite();
  const [entries, setEntries] = useState(calendar.entries);
  const [seen, setSeen] = useState(calendar);
  const inMonth = (day: string) => day.startsWith(calendar.month);
  const initial =
    calendar.days.includes(calendar.today) && inMonth(calendar.today) ? calendar.today : `${calendar.month}-01`;
  const [selected, setSelected] = useState(initial);
  if (seen !== calendar) {
    setSeen(calendar);
    setEntries(calendar.entries);
    setSelected(initial);
  }

  const onDay = (day: string) => entries.filter((e) => e.date === day);
  const selectedEntries = onDay(selected);

  async function move(entry: MealEntry, date: string) {
    if (!date || date === entry.date) return;
    const before = entries;
    setEntries((list) => list.map((e) => (e.id === entry.id && e.kind === entry.kind ? { ...e, date } : e)));
    const done = await write(
      () => (entry.kind === "planned" ? movePlannedMeal({ id: entry.id, date }) : moveCookLog({ id: entry.id, date })),
      {
        success: t("moved", {
          name: entry.name,
          date: format.dateTime(asDate(date), { day: "numeric", month: "long" }),
        }),
      },
    );
    if (!done) setEntries(before);
  }

  async function remove(entry: MealEntry) {
    const before = entries;
    setEntries((list) => list.filter((e) => !(e.id === entry.id && e.kind === entry.kind)));
    const undo = async () => {
      const restored =
        entry.kind === "planned"
          ? await write(() => addPlannedMeal({ dishId: entry.dishId, date: entry.date, mealSlot: entry.mealSlot }))
          : await write(() =>
              restoreCookLog({
                dishId: entry.dishId,
                date: entry.date,
                mealSlot: entry.mealSlot,
                source: entry.source,
              }),
            );
      if (restored) setEntries((list) => [...list, { ...entry, id: restored.id }]);
    };
    const done = await write<unknown>(
      () => (entry.kind === "planned" ? removePlannedMeal({ id: entry.id }) : undoLogCook({ id: entry.id })),
      { success: t("removed", { name: entry.name }), undo: () => void undo() },
    );
    if (!done) setEntries(before);
  }

  const weekdays = calendar.days.slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label={t("previousMonth")} variant="outline" asChild>
            <Link href={{ pathname: "/calendar", query: { month: addMonths(calendar.month, -1) } }}>
              <ChevronLeftIcon aria-hidden="true" className="rtl:-scale-x-100" />
            </Link>
          </IconButton>
          <p className="min-w-36 text-center font-medium capitalize" aria-live="polite">
            {format.dateTime(asDate(`${calendar.month}-15`), { month: "long", year: "numeric" })}
          </p>
          <IconButton label={t("nextMonth")} variant="outline" asChild>
            <Link href={{ pathname: "/calendar", query: { month: addMonths(calendar.month, 1) } }}>
              <ChevronRightIcon aria-hidden="true" className="rtl:-scale-x-100" />
            </Link>
          </IconButton>
          {calendar.today.slice(0, 7) !== calendar.month ? (
            <Button asChild variant="ghost">
              <Link href="/calendar">{t("thisMonth")}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="rounded-3xl border border-border bg-card p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 pb-2" aria-hidden="true">
            {weekdays.map((day) => (
              <p key={day} className="text-center text-xs font-medium text-muted-foreground capitalize">
                <span className="sm:hidden">{format.dateTime(asDate(day), { weekday: "narrow" })}</span>
                <span className="hidden sm:inline">{format.dateTime(asDate(day), { weekday: "short" })}</span>
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendar.days.map((day) => {
              const dayEntries = onDay(day);
              const planned = dayEntries.filter((e) => e.kind === "planned").length;
              const cooked = dayEntries.filter((e) => e.kind === "cooked").length;
              const dayEvents = dayEntries.filter((e) => e.kind === "event").length;
              const label = [
                format.dateTime(asDate(day), { weekday: "long", day: "numeric", month: "long" }),
                planned ? t("plannedCount", { count: planned }) : null,
                cooked ? t("cookedCount", { count: cooked }) : null,
                dayEvents ? t("eventCount", { count: dayEvents }) : null,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={label}
                  aria-pressed={day === selected}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "flex aspect-square min-h-11 flex-col items-center justify-start gap-1 rounded-xl p-1 text-sm transition-colors sm:aspect-auto sm:min-h-20 sm:items-start sm:p-2",
                    day === selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    !inMonth(day) && day !== selected && "text-muted-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "tabular-nums",
                      day === calendar.today && day !== selected && "font-bold text-primary-strong",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <span className="flex flex-wrap gap-0.5" aria-hidden="true">
                    {dayEvents > 0 ? (
                      <span
                        className={cn("size-1.5 rotate-45", day === selected ? "bg-primary-foreground" : "bg-tile")}
                      />
                    ) : null}
                    {Array.from({ length: Math.min(cooked, 3) }, (_, i) => (
                      <span
                        key={`c${i}`}
                        className={cn(
                          "size-1.5 rounded-full",
                          day === selected ? "bg-primary-foreground" : "bg-primary-strong",
                        )}
                      />
                    ))}
                    {Array.from({ length: Math.min(planned, 3) }, (_, i) => (
                      <span
                        key={`p${i}`}
                        className={cn(
                          "size-1.5 rounded-full border",
                          day === selected ? "border-primary-foreground" : "border-primary-strong",
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="flex flex-wrap gap-4 px-2 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary-strong" />
              {t("legendCooked")}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full border border-primary-strong" />
              {t("legendPlanned")}
            </span>
          </p>
        </div>

        <section
          aria-labelledby="calendar-day"
          className="space-y-4 rounded-3xl border border-border bg-card p-5"
          aria-live="polite"
        >
          <h2 id="calendar-day" className="font-heading text-2xl capitalize">
            {format.dateTime(asDate(selected), { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {selectedEntries.length === 0 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">{t("emptyDay")}</p>
              <Button asChild variant="outline">
                <Link href={{ pathname: "/planner", query: { week: selected } }}>
                  <ClipboardListIcon aria-hidden="true" data-icon="inline-start" />
                  {t("planThisDay")}
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {selectedEntries
                .filter((e) => e.kind === "event")
                .map((event) => (
                  <li key={`event-${event.id}`} className="space-y-1 rounded-2xl border border-tile/40 bg-card p-3">
                    <p className="text-xs font-medium text-primary-strong">{t("event")}</p>
                    <Link
                      href={`/planner/events/${event.id}`}
                      className="block font-medium underline-offset-4 hover:underline"
                    >
                      {event.name}
                    </Link>
                    {event.kind === "event" ? (
                      <p className="text-sm text-muted-foreground">{t("guests", { count: event.guests })}</p>
                    ) : null}
                  </li>
                ))}
              {selectedEntries.filter(isMeal).map((entry) => (
                <li key={`${entry.kind}-${entry.id}`} className="space-y-2 rounded-2xl bg-muted p-3">
                  <p className="text-xs font-medium text-primary-strong">
                    {entry.kind === "cooked" ? t("cooked") : t("planned")}
                  </p>
                  <Link
                    href={`/dishes/${entry.dishId}`}
                    className="block font-medium underline-offset-4 hover:underline"
                  >
                    {entry.name}
                  </Link>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      <span className="block">{t("moveTo")}</span>
                      <Input
                        type="date"
                        defaultValue={entry.date}
                        className="h-9 w-40"
                        onChange={(e) => void move(entry, e.target.value)}
                      />
                    </label>
                    {entry.kind === "planned" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dishes/${entry.dishId}/cook`}>
                          <ChefHatIcon aria-hidden="true" data-icon="inline-start" />
                          {t("cook")}
                        </Link>
                      </Button>
                    ) : null}
                    <IconButton label={t("remove", { name: entry.name })} onClick={() => remove(entry)}>
                      <Trash2Icon aria-hidden="true" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={{ pathname: "/planner", query: { week: selected } }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-strong underline-offset-4 hover:underline"
          >
            <CalendarDaysIcon aria-hidden="true" className="size-4" />
            {t("openWeek")}
          </Link>
        </section>
      </div>
    </div>
  );
}
