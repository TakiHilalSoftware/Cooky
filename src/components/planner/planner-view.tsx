"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ChefHatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  GripVerticalIcon,
  PartyPopperIcon,
  ShoppingBasketIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { addDays } from "@/lib/dates";
import { MEAL_SLOTS, type MealSlot } from "@/lib/dishes";
import { cn } from "@/lib/utils";
import { addPlannedMeal, copyPlannerWeek, movePlannedMeal, removePlannedMeal } from "@/server/actions/planner";
import { addToShopping } from "@/server/actions/shopping";
import type { LibraryDishDto, PlannedMealDto, PlannerDto, PlannerEventDto } from "@/server/features/planner/dto";

import { RepeatDialog } from "./repeat-dialog";
import { usePlannerWrite } from "./use-planner-actions";

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * The weekly planner (PRD §3.5): drag a dish from the library onto a day, or
 * tap a dish and then a day's "+". Meals move by drag or from their menu;
 * removing offers Undo. Everything here shows on the calendar too.
 */
export function PlannerView({ planner }: { planner: PlannerDto }) {
  const t = useTranslations("planner");
  const format = useFormatter();
  const write = usePlannerWrite();
  const [meals, setMeals] = useState(planner.meals);
  const [seen, setSeen] = useState(planner);
  if (seen !== planner) {
    setSeen(planner);
    setMeals(planner.meals);
  }
  const [selected, setSelected] = useState<LibraryDishDto | null>(null);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [repeating, setRepeating] = useState<PlannedMealDto | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const dndId = useId();
  const libraryById = useMemo(() => new Map(planner.library.map((d) => [d.id, d])), [planner.library]);

  async function add(dish: LibraryDishDto, date: string) {
    const created = await write(() => addPlannedMeal({ dishId: dish.id, date }), {
      success: t("added", { name: dish.name, day: format.dateTime(asDate(date), { weekday: "long" }) }),
    });
    if (created) setMeals((list) => [...list, { ...created, name: dish.name, photoUrl: null }]);
  }

  async function move(meal: PlannedMealDto, date: string, mealSlot?: MealSlot | null) {
    const before = meals;
    setMeals((list) =>
      list.map((m) =>
        m.id === meal.id ? { ...m, date, mealSlot: mealSlot === undefined ? m.mealSlot : mealSlot } : m,
      ),
    );
    const moved = await write(() => movePlannedMeal({ id: meal.id, date, mealSlot }));
    if (!moved) setMeals(before);
  }

  async function remove(meal: PlannedMealDto) {
    const before = meals;
    setMeals((list) => list.filter((m) => m.id !== meal.id));
    const removed = await write(() => removePlannedMeal({ id: meal.id }), {
      success: t("removed", { name: meal.name }),
      undo: () => {
        void write(() => addPlannedMeal({ dishId: meal.dishId, date: meal.date, mealSlot: meal.mealSlot })).then(
          (created) => {
            if (created) setMeals((list) => [...list, { ...meal, id: created.id }]);
          },
        );
      },
    });
    if (!removed) setMeals(before);
  }

  async function shopWeek() {
    const result = await write(() => addToShopping({ source: "week", weekStart: planner.weekStart }));
    if (result) toast.success(t("shopped", { count: result.added }));
  }

  async function copyLastWeek() {
    const result = await write(() => copyPlannerWeek({ from: addDays(planner.weekStart, -7), to: planner.weekStart }));
    if (result) toast.success(result.copied > 0 ? t("copied", { count: result.copied }) : t("nothingToCopy"));
  }

  function onDragEnd(event: DragEndEvent) {
    const over = event.over?.id;
    const active = String(event.active.id);
    if (typeof over !== "string" || !over.startsWith("day:")) return;
    const date = over.slice(4);
    if (active.startsWith("lib:")) {
      const dish = libraryById.get(active.slice(4));
      if (dish) void add(dish, date);
    } else if (active.startsWith("meal:")) {
      const meal = meals.find((m) => m.id === active.slice(5));
      if (meal && meal.date !== date) void move(meal, date);
    }
  }

  // Two plain dates, not dateTimeRange: Node and browsers format ranges with different spacing,
  // which breaks hydration.
  const range = t("weekRange", {
    start: format.dateTime(asDate(planner.days[0]!), { day: "numeric", month: "short" }),
    end: format.dateTime(asDate(planner.days[6]!), { day: "numeric", month: "short", year: "numeric" }),
  });

  return (
    // A stable id: dnd-kit's own counter differs between server and client and breaks hydration.
    <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-heading text-4xl">{t("title")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label={t("previousWeek")} variant="outline" asChild>
              <Link href={{ pathname: "/planner", query: { week: addDays(planner.weekStart, -7) } }}>
                <ChevronLeftIcon aria-hidden="true" className="rtl:-scale-x-100" />
              </Link>
            </IconButton>
            <p className="min-w-40 text-center font-medium tabular-nums" aria-live="polite">
              {range}
            </p>
            <IconButton label={t("nextWeek")} variant="outline" asChild>
              <Link href={{ pathname: "/planner", query: { week: addDays(planner.weekStart, 7) } }}>
                <ChevronRightIcon aria-hidden="true" className="rtl:-scale-x-100" />
              </Link>
            </IconButton>
            {!planner.days.includes(planner.today) ? (
              <Button asChild variant="ghost">
                <Link href="/planner">{t("thisWeek")}</Link>
              </Button>
            ) : null}
            <Button variant="outline" disabled={meals.length === 0} onClick={shopWeek}>
              <ShoppingBasketIcon aria-hidden="true" data-icon="inline-start" />
              {t("shopWeek")}
            </Button>
            <Button asChild variant="outline">
              <Link href="/planner/events">
                <PartyPopperIcon aria-hidden="true" data-icon="inline-start" />
                {t("events")}
              </Link>
            </Button>
            {planner.lastWeekCount > 0 ? (
              <Button variant="outline" onClick={copyLastWeek}>
                <CopyIcon aria-hidden="true" data-icon="inline-start" />
                {t("copyLastWeek")}
              </Button>
            ) : null}
          </div>
        </div>

        {selected ? (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary p-3">
            <p className="flex-1 text-sm">{t("placing", { name: selected.name })}</p>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              <XIcon aria-hidden="true" data-icon="inline-start" />
              {t("cancelPlacing")}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Library
            library={planner.library}
            collections={planner.collections}
            selected={selected}
            onSelect={(dish) => setSelected(selected?.id === dish.id ? null : dish)}
          />
          {planner.library.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center lg:col-start-2">
              <p className="font-heading text-2xl">{t("emptyTitle")}</p>
              <p className="mt-2 text-muted-foreground">{t("emptyBody")}</p>
              <Button asChild className="mt-5">
                <Link href="/dishes/new">{t("addDish")}</Link>
              </Button>
            </div>
          ) : (
            <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {planner.days.map((day) => (
                <DayCard
                  key={day}
                  day={day}
                  today={planner.today}
                  meals={meals.filter((m) => m.date === day)}
                  events={planner.events.filter((e) => e.date === day)}
                  days={planner.days}
                  selected={selected}
                  onAdd={() => {
                    if (selected) {
                      void add(selected, day);
                      setSelected(null);
                    } else setPickerDay(day);
                  }}
                  onMove={move}
                  onRemove={remove}
                  onRepeat={setRepeating}
                />
              ))}
            </ol>
          )}
        </div>
      </div>

      <Sheet open={pickerDay !== null} onOpenChange={(open) => !open && setPickerDay(null)}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>
              {pickerDay
                ? t("pickFor", {
                    day: format.dateTime(asDate(pickerDay), { weekday: "long", day: "numeric", month: "long" }),
                  })
                : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <Library
              library={planner.library}
              collections={planner.collections}
              selected={null}
              compact
              onSelect={(dish) => {
                if (pickerDay) void add(dish, pickerDay);
                setPickerDay(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <RepeatDialog meal={repeating} weekStart={planner.weekStart} onClose={() => setRepeating(null)} />
    </DndContext>
  );
}

function Library({
  library,
  collections,
  selected,
  onSelect,
  compact = false,
}: {
  library: LibraryDishDto[];
  collections: PlannerDto["collections"];
  selected: LibraryDishDto | null;
  onSelect: (dish: LibraryDishDto) => void;
  compact?: boolean;
}) {
  const t = useTranslations("planner");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const folded = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const shown = library.filter(
    (d) => (!query || folded(d.name).includes(folded(query))) && (!collection || d.collectionIds.includes(collection)),
  );
  return (
    <aside aria-label={t("libraryLabel")} className={cn("space-y-3", !compact && "hidden lg:block")}>
      {compact ? null : <h2 className="font-heading text-xl">{t("libraryHeading")}</h2>}
      {compact ? null : <p className="text-sm text-muted-foreground">{t("libraryHint")}</p>}
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ps-9"
        />
      </div>
      {collections.length > 0 ? (
        <NativeSelect
          aria-label={t("collectionLabel")}
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">{t("allDishes")}</NativeSelectOption>
          {collections.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMatch")}</p>
      ) : (
        <ul className={cn("space-y-1", !compact && "max-h-[60dvh] overflow-y-auto pe-1")}>
          {shown.map((dish) => (
            <LibraryItem
              key={dish.id}
              dish={dish}
              active={selected?.id === dish.id}
              draggable={!compact}
              onSelect={() => onSelect(dish)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function LibraryItem({
  dish,
  active,
  draggable,
  onSelect,
}: {
  dish: LibraryDishDto;
  active: boolean;
  draggable: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("planner");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lib:${dish.id}`,
    disabled: !draggable,
  });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        "flex items-center gap-1 rounded-xl border bg-card",
        active ? "border-primary-strong bg-secondary" : "border-transparent",
        isDragging && "relative z-50 shadow-lg",
      )}
    >
      {draggable ? (
        <button
          type="button"
          className="grid size-11 shrink-0 cursor-grab place-items-center text-muted-foreground"
          aria-label={t("dragDish", { name: dish.name })}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        aria-pressed={draggable ? active : undefined}
        onClick={onSelect}
        className="min-h-11 min-w-0 flex-1 truncate px-2 text-start text-sm font-medium"
      >
        {dish.name}
      </button>
    </li>
  );
}

function DayCard({
  day,
  today,
  meals,
  events,
  days,
  selected,
  onAdd,
  onMove,
  onRemove,
  onRepeat,
}: {
  day: string;
  today: string;
  meals: PlannedMealDto[];
  events: PlannerEventDto[];
  days: string[];
  selected: LibraryDishDto | null;
  onAdd: () => void;
  onMove: (meal: PlannedMealDto, date: string, mealSlot?: MealSlot | null) => void;
  onRemove: (meal: PlannedMealDto) => void;
  onRepeat: (meal: PlannedMealDto) => void;
}) {
  const t = useTranslations("planner");
  const format = useFormatter();
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  const isToday = day === today;
  return (
    <li
      ref={setNodeRef}
      aria-labelledby={`day-${day}`}
      className={cn(
        "flex min-h-40 flex-col gap-3 rounded-3xl border bg-card p-4 transition-colors",
        isOver ? "border-primary-strong bg-secondary" : isToday ? "border-primary-strong" : "border-border",
        day < today && "opacity-80",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`day-${day}`} className="font-heading text-lg capitalize">
          {format.dateTime(asDate(day), { weekday: "long", day: "numeric", month: "short" })}
        </h2>
        {isToday ? <Badge>{t("today")}</Badge> : null}
      </div>
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/planner/events/${event.id}`}
          className="flex items-center gap-2 rounded-2xl border border-tile/40 px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <PartyPopperIcon aria-hidden="true" className="size-4 shrink-0 text-tile" />
          <span className="min-w-0 flex-1 truncate">{event.name}</span>
          <span className="text-xs text-muted-foreground">{t("guests", { count: event.guests })}</span>
        </Link>
      ))}
      {meals.length === 0 && events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothingPlanned")}</p>
      ) : null}
      <ul className="space-y-2">
        {meals.map((meal) => (
          <MealItem
            key={meal.id}
            meal={meal}
            days={days}
            today={today}
            onMove={onMove}
            onRemove={onRemove}
            onRepeat={onRepeat}
          />
        ))}
      </ul>
      <Button variant={selected ? "default" : "ghost"} size="sm" className="mt-auto justify-start" onClick={onAdd}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        {selected ? t("addHere", { name: selected.name }) : t("add")}
      </Button>
    </li>
  );
}

function MealItem({
  meal,
  days,
  today,
  onMove,
  onRemove,
  onRepeat,
}: {
  meal: PlannedMealDto;
  days: string[];
  today: string;
  onMove: (meal: PlannedMealDto, date: string, mealSlot?: MealSlot | null) => void;
  onRemove: (meal: PlannedMealDto) => void;
  onRepeat: (meal: PlannedMealDto) => void;
}) {
  const t = useTranslations("planner");
  const tSlots = useTranslations("planner.slots");
  const format = useFormatter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `meal:${meal.id}` });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn("flex items-center gap-1 rounded-2xl bg-muted ps-1 pe-1", isDragging && "relative z-50 shadow-lg")}
    >
      <button
        type="button"
        className="grid size-10 shrink-0 cursor-grab place-items-center text-muted-foreground pointer-coarse:size-11"
        aria-label={t("dragMeal", { name: meal.name })}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon aria-hidden="true" className="size-4" />
      </button>
      <div className="min-w-0 flex-1 py-2">
        {meal.mealSlot ? <p className="text-xs text-primary-strong">{tSlots(meal.mealSlot)}</p> : null}
        <Link
          href={`/dishes/${meal.dishId}`}
          className="block truncate text-sm font-medium underline-offset-4 hover:underline"
        >
          {meal.name}
        </Link>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("mealMenu", { name: meal.name })}>
            <EllipsisVerticalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/dishes/${meal.dishId}/cook`}>
              <ChefHatIcon aria-hidden="true" />
              {t("startCooking")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("slot")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={meal.mealSlot ?? "none"}
                onValueChange={(v) => onMove(meal, meal.date, v === "none" ? null : (v as MealSlot))}
              >
                <DropdownMenuRadioItem value="none">{tSlots("none")}</DropdownMenuRadioItem>
                {MEAL_SLOTS.map((slot) => (
                  <DropdownMenuRadioItem key={slot} value={slot}>
                    {tSlots(slot)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("moveTo")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {[...days, addDays(days[6]!, 1)].map((day) => (
                <DropdownMenuItem key={day} disabled={day === meal.date} onSelect={() => onMove(meal, day)}>
                  {format.dateTime(asDate(day), { weekday: "long", day: "numeric", month: "short" })}
                  {day === today ? ` · ${t("today")}` : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => onRepeat(meal)}>
            <RepeatIcon aria-hidden="true" />
            {t("repeat")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onRemove(meal)}>
            <Trash2Icon aria-hidden="true" />
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
