"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { focusFirstInvalid } from "@/components/forms/focus-first-invalid";
import { FormAlert } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRouter } from "@/i18n/navigation";
import {
  COURSES,
  DIETARY_TAGS,
  DIFFICULTIES,
  DISH_BOUNDS,
  SEASONS,
  UNITS,
  type Course,
  type DietaryTag,
  type Difficulty,
  type Season,
  type Unit,
} from "@/lib/dishes";
import { checkFields, type FieldErrorKeys } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { createDish, updateDish } from "@/server/actions/dishes";
import type { DishFormDto } from "@/server/features/dishes/dto";
import { dishInputSchema } from "@/server/features/dishes/schema";

import { IngredientNameField } from "./ingredient-name-field";

type IngredientRow = { key: number; amount: string; unit: Unit | ""; name: string; note: string };
type StepRow = { key: number; text: string; timerMinutes: string; prepDayBefore: boolean };
type FormState = {
  name: string;
  course: Course;
  difficulty: Difficulty;
  servings: string;
  seasons: Season[];
  dietaryTags: DietaryTag[];
  ingredients: IngredientRow[];
  steps: StepRow[];
  caloriesKcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

const text = (value: number | null) => (value === null ? "" : String(value));
/** "" → null; "1,5" and "1.5" → 1.5; anything else → NaN, which the schema reports. */
const parseNumber = (value: string) => (value.trim() === "" ? null : Number(value.trim().replace(",", ".")));

function initialState(dish: DishFormDto | undefined, nextKey: () => number): FormState {
  return {
    name: dish?.name ?? "",
    course: dish?.course ?? "main",
    difficulty: dish?.difficulty ?? "easy",
    servings: String(dish?.servings ?? 4),
    seasons: dish?.seasons ?? [],
    dietaryTags: dish?.dietaryTags ?? [],
    ingredients: (dish?.ingredients.length ? dish.ingredients : [null]).map((i) => ({
      key: nextKey(),
      amount: text(i?.amount ?? null),
      unit: i?.unit ?? "",
      name: i?.name ?? "",
      note: i?.note ?? "",
    })),
    steps: (dish?.steps ?? []).map((s) => ({
      key: nextKey(),
      text: s.text,
      timerMinutes: text(s.timerMinutes),
      prepDayBefore: s.prepDayBefore,
    })),
    caloriesKcal: text(dish?.caloriesKcal ?? null),
    proteinG: text(dish?.proteinG ?? null),
    carbsG: text(dish?.carbsG ?? null),
    fatG: text(dish?.fatG ?? null),
  };
}

function toInput(state: FormState) {
  return {
    name: state.name,
    course: state.course,
    difficulty: state.difficulty,
    servings: parseNumber(state.servings),
    seasons: state.seasons,
    dietaryTags: state.dietaryTags,
    ingredients: state.ingredients.map((i) => ({
      name: i.name,
      amount: parseNumber(i.amount),
      unit: i.unit === "" ? null : i.unit,
      note: i.note,
    })),
    steps: state.steps.map((s) => ({
      text: s.text,
      timerMinutes: parseNumber(s.timerMinutes),
      prepDayBefore: s.prepDayBefore,
    })),
    caloriesKcal: parseNumber(state.caloriesKcal),
    proteinG: parseNumber(state.proteinG),
    carbsG: parseNumber(state.carbsG),
    fatG: parseNumber(state.fatG),
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Add or edit a dish. The schema hints as you go; the server's answer wins. */
export function DishForm({ dish }: { dish?: DishFormDto }) {
  const t = useTranslations("dishes");
  const tf = useTranslations("dishes.form");
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // Stable keys for rows, so React keeps each row's inputs when rows move.
  const [nextKey] = useState(() => {
    let n = 0;
    return () => ++n;
  });
  const [initial] = useState(() => initialState(dish, nextKey));
  const [state, setState] = useState(initial);
  const [errors, setErrors] = useState<FieldErrorKeys>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const pendingFocus = useRef<string | null>(null);
  const create = useAction(createDish);
  const update = useAction(updateDish);
  const pending = create.isPending || update.isPending;
  const saved = useRef(false);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  // Leaving with unsaved changes (closing the tab, reloading) asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!saved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // A new row gets the focus once it's rendered, so typing can continue at once.
  useEffect(() => {
    if (!pendingFocus.current) return;
    formRef.current?.querySelector<HTMLElement>(`[data-focus-key="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...state, [key]: value };
    setState(next);
    if (submitted) {
      const check = checkFields(dishInputSchema, toInput(next));
      setErrors(check.ok ? {} : check.errors);
    }
  }

  const setIngredient = (index: number, patch: Partial<IngredientRow>) =>
    setField(
      "ingredients",
      state.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  const setStep = (index: number, patch: Partial<StepRow>) =>
    setField(
      "steps",
      state.steps.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  function addIngredient() {
    const key = nextKey();
    setField("ingredients", [...state.ingredients, { key, amount: "", unit: "", name: "", note: "" }]);
    pendingFocus.current = `ingredient-${key}`;
  }

  function addStep() {
    const key = nextKey();
    setField("steps", [...state.steps, { key, text: "", timerMinutes: "", prepDayBefore: false }]);
    pendingFocus.current = `step-${key}`;
  }

  const servings = parseNumber(state.servings);
  const stepServings = (delta: number) => {
    const current = Number.isFinite(servings) && servings !== null ? servings : 4;
    const next = Math.min(DISH_BOUNDS.servingsMax, Math.max(DISH_BOUNDS.servingsMin, Math.round(current) + delta));
    setField("servings", String(next));
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const check = checkFields(dishInputSchema, toInput(state));
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstInvalid(formRef.current, check.errors);
      return;
    }
    setErrors({});
    const result = dish
      ? await update.executeAsync({ ...check.data, id: dish.id })
      : await create.executeAsync(check.data);
    if (result.data) {
      saved.current = true;
      toast.success(dish ? tf("saved") : tf("created", { name: check.data.name }));
      router.push(`/dishes/${result.data.id}`);
      return;
    }
    // A full box opens the upgrade sheet; other errors show above the form.
    if (result.serverError === "quota_exceeded" || result.serverError === "plan_required") {
      onActionError(result.serverError, "dishes");
    }
  }

  /** Back to where the person came from: the dish they were editing, or the box. */
  const leave = () => router.push(dish ? `/dishes/${dish.id}` : "/dishes");

  const serverError = (dish ? update : create).result.serverError;
  const err = (path: string) => messages.field(errors[path]);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="space-y-6">
      {hasErrors ? <FormAlert tone="error">{tf("fixErrors")}</FormAlert> : null}
      {serverError && serverError !== "quota_exceeded" ? (
        <FormAlert tone="error">{messages.action(serverError)}</FormAlert>
      ) : null}

      <Section title={tf("basics")}>
        <div className="space-y-5">
          <TextField
            label={tf("nameLabel")}
            name="name"
            placeholder={tf("namePlaceholder")}
            maxLength={DISH_BOUNDS.nameMax}
            value={state.name}
            onChange={(e) => setField("name", e.target.value)}
            error={err("name")}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label={tf("courseLabel")}
              name="course"
              value={state.course}
              onChange={(value) => setField("course", value as Course)}
              options={COURSES.map((c) => ({ value: c, label: t(`course.${c}`) }))}
            />
            <ServingsField
              label={tf("servingsLabel")}
              hint={tf("servingsHint")}
              value={state.servings}
              error={err("servings")}
              onChange={(value) => setField("servings", value)}
              onStep={stepServings}
              fewerLabel={tf("fewer")}
              moreLabel={tf("more")}
              canDecrease={servings === null || Number.isNaN(servings) || servings > DISH_BOUNDS.servingsMin}
              canIncrease={servings === null || Number.isNaN(servings) || servings < DISH_BOUNDS.servingsMax}
            />
          </div>
          <ChipGroup
            label={tf("difficultyLabel")}
            type="single"
            value={[state.difficulty]}
            onChange={(values) => values[0] && setField("difficulty", values[0] as Difficulty)}
            options={DIFFICULTIES.map((d) => ({ value: d, label: t(`difficulty.${d}`) }))}
          />
          <ChipGroup
            label={tf("seasonsLabel")}
            hint={tf("seasonsHint")}
            type="multiple"
            value={state.seasons}
            onChange={(values) =>
              setField(
                "seasons",
                SEASONS.filter((s) => values.includes(s)),
              )
            }
            options={SEASONS.map((s) => ({ value: s, label: t(`season.${s}`) }))}
          />
          <ChipGroup
            label={tf("dietLabel")}
            hint={tf("dietHint")}
            type="multiple"
            value={state.dietaryTags}
            onChange={(values) =>
              setField(
                "dietaryTags",
                DIETARY_TAGS.filter((d) => values.includes(d)),
              )
            }
            options={DIETARY_TAGS.map((d) => ({ value: d, label: t(`diet.${d}`) }))}
          />
        </div>
      </Section>

      <Section title={tf("ingredients")} hint={tf("ingredientsHint")} error={err("ingredients")}>
        <div
          aria-hidden="true"
          className="mb-2 hidden gap-2 px-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[5.5rem_8.5rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <span>{tf("amountLabel")}</span>
          <span>{tf("unitLabel")}</span>
          <span>{tf("ingredientNameLabel")}</span>
          <span>{tf("noteLabel")}</span>
          <span className="w-[8.25rem]" />
        </div>
        <ol className="space-y-2">
          {state.ingredients.map((row, index) => {
            const item = tf("ingredientN", { n: index + 1 });
            const base = `ingredients.${index}`;
            return (
              <li
                key={row.key}
                aria-label={item}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[5.5rem_8.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start sm:border-0 sm:p-0"
              >
                <RowField label={tf("amountLabel")} error={err(`${base}.amount`)}>
                  {(props) => (
                    <Input
                      {...props}
                      name={`${base}.amount`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.amount}
                      onChange={(e) => setIngredient(index, { amount: e.target.value })}
                    />
                  )}
                </RowField>
                <RowField label={tf("unitLabel")}>
                  {(props) => (
                    <NativeSelect
                      {...props}
                      className="w-full"
                      name={`${base}.unit`}
                      value={row.unit}
                      onChange={(e) => setIngredient(index, { unit: e.target.value as Unit | "" })}
                    >
                      <NativeSelectOption value="">{tf("noUnit")}</NativeSelectOption>
                      {UNITS.map((u) => (
                        <NativeSelectOption key={u} value={u}>
                          {t(`unitName.${u}`)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </RowField>
                <RowField
                  label={tf("ingredientNameLabel")}
                  error={err(`${base}.name`)}
                  className="col-span-2 sm:col-span-1"
                >
                  {(props) => (
                    <IngredientNameField
                      {...props}
                      name={`${base}.name`}
                      data-focus-key={`ingredient-${row.key}`}
                      placeholder={index === 0 ? tf("ingredientNamePlaceholder") : undefined}
                      maxLength={DISH_BOUNDS.ingredientNameMax}
                      value={row.name}
                      onChange={(name) => setIngredient(index, { name })}
                      // A picked staple brings its usual unit, unless one was already chosen.
                      onPick={(s) =>
                        row.unit === "" && s.defaultUnit && setIngredient(index, { name: s.name, unit: s.defaultUnit })
                      }
                    />
                  )}
                </RowField>
                <RowField label={tf("noteLabel")} error={err(`${base}.note`)} className="col-span-2 sm:col-span-1">
                  {(props) => (
                    <Input
                      {...props}
                      name={`${base}.note`}
                      placeholder={index === 0 ? tf("notePlaceholder") : undefined}
                      maxLength={DISH_BOUNDS.ingredientNoteMax}
                      value={row.note}
                      onChange={(e) => setIngredient(index, { note: e.target.value })}
                    />
                  )}
                </RowField>
                <RowActions
                  item={item}
                  index={index}
                  count={state.ingredients.length}
                  onMove={(to) => setField("ingredients", move(state.ingredients, index, to))}
                  onRemove={() =>
                    setField(
                      "ingredients",
                      state.ingredients.filter((_, i) => i !== index),
                    )
                  }
                />
              </li>
            );
          })}
        </ol>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={addIngredient}
          disabled={state.ingredients.length >= DISH_BOUNDS.ingredientsMax}
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {tf("addIngredient")}
        </Button>
      </Section>

      <Section title={tf("steps")} hint={tf("stepsHint")} error={err("steps")}>
        {state.steps.length > 0 ? (
          <ol className="space-y-3">
            {state.steps.map((row, index) => {
              const item = tf("stepN", { n: index + 1 });
              const base = `steps.${index}`;
              return (
                <li key={row.key} aria-label={item} className="space-y-3 rounded-2xl border border-border p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-lg">{item}</p>
                    <RowActions
                      item={item}
                      index={index}
                      count={state.steps.length}
                      allowEmpty
                      onMove={(to) => setField("steps", move(state.steps, index, to))}
                      onRemove={() =>
                        setField(
                          "steps",
                          state.steps.filter((_, i) => i !== index),
                        )
                      }
                    />
                  </div>
                  <RowField label={tf("stepLabel")} error={err(`${base}.text`)} visibleLabel>
                    {(props) => (
                      <Textarea
                        {...props}
                        name={`${base}.text`}
                        data-focus-key={`step-${row.key}`}
                        rows={2}
                        placeholder={index === 0 ? tf("stepPlaceholder") : undefined}
                        maxLength={DISH_BOUNDS.stepTextMax}
                        value={row.text}
                        onChange={(e) => setStep(index, { text: e.target.value })}
                      />
                    )}
                  </RowField>
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <RowField
                      label={tf("timerLabel")}
                      hint={tf("timerHint")}
                      error={err(`${base}.timerMinutes`)}
                      visibleLabel
                      className="w-40"
                    >
                      {(props) => (
                        <Input
                          {...props}
                          name={`${base}.timerMinutes`}
                          inputMode="numeric"
                          autoComplete="off"
                          value={row.timerMinutes}
                          onChange={(e) => setStep(index, { timerMinutes: e.target.value })}
                        />
                      )}
                    </RowField>
                    <CheckboxField
                      label={tf("prepDayBefore")}
                      checked={row.prepDayBefore}
                      onChange={(checked) => setStep(index, { prepDayBefore: checked })}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className={cn(state.steps.length > 0 && "mt-3")}
          onClick={addStep}
          disabled={state.steps.length >= DISH_BOUNDS.stepsMax}
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {tf("addStep")}
        </Button>
      </Section>

      <details
        className="group rounded-3xl border border-border bg-card p-5 sm:p-6"
        open={Boolean(state.caloriesKcal || state.proteinG || state.carbsG || state.fatG) || undefined}
      >
        <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center [&::-webkit-details-marker]:hidden">
          <span className="font-heading text-xl">{tf("nutrition")}</span>
          <span className="text-sm text-muted-foreground">{tf("nutritionHint")}</span>
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["caloriesKcal", "proteinG", "carbsG", "fatG"] as const).map((key) => (
            <TextField
              key={key}
              label={tf(
                key === "caloriesKcal"
                  ? "caloriesLabel"
                  : key === "proteinG"
                    ? "proteinLabel"
                    : key === "carbsG"
                      ? "carbsLabel"
                      : "fatLabel",
              )}
              name={key}
              inputMode="decimal"
              autoComplete="off"
              value={state[key]}
              onChange={(e) => setField(key, e.target.value)}
              error={err(key)}
            />
          ))}
        </div>
      </details>

      {/* Thumb-reachable on phones: the actions stay at the bottom of the screen. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Button type="button" variant="ghost" size="lg" onClick={() => (dirty ? setConfirmDiscard(true) : leave())}>
          {tf("cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? (dish ? tf("saving") : tf("creating")) : dish ? tf("save") : tf("create")}
        </Button>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tf("discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{tf("discardBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tf("keepEditing")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                saved.current = true;
                leave();
              }}
            >
              {tf("discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function Section({
  title,
  hint,
  error,
  children,
}: {
  title: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 id={id} className="font-heading text-xl">
        {title}
      </h2>
      {hint ? <p className="mt-1 text-sm text-pretty text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

/** A labelled control inside a row. Labels hide on wide screens, where the column headers say the same. */
function RowField({
  label,
  hint,
  error,
  visibleLabel = false,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  visibleLabel?: boolean;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <Field data-invalid={error ? true : undefined} className={cn("gap-1", className)}>
      <FieldLabel htmlFor={id} className={cn(visibleLabel ? "text-sm" : "text-xs sm:sr-only")}>
        {label}
      </FieldLabel>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

function RowActions({
  item,
  index,
  count,
  allowEmpty = false,
  onMove,
  onRemove,
}: {
  item: string;
  index: number;
  count: number;
  /** Steps may all be removed; a dish keeps at least one ingredient row. */
  allowEmpty?: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const tf = useTranslations("dishes.form");
  return (
    <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
      <IconButton type="button" label={tf("moveUp", { item })} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUpIcon aria-hidden="true" />
      </IconButton>
      <IconButton
        type="button"
        label={tf("moveDown", { item })}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDownIcon aria-hidden="true" />
      </IconButton>
      <IconButton
        type="button"
        label={tf("remove", { item })}
        disabled={!allowEmpty && count === 1}
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2Icon aria-hidden="true" />
      </IconButton>
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} name={name} className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

function ServingsField({
  label,
  hint,
  value,
  error,
  onChange,
  onStep,
  fewerLabel,
  moreLabel,
  canDecrease,
  canIncrease,
}: {
  label: string;
  hint: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onStep: (delta: number) => void;
  fewerLabel: string;
  moreLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
}) {
  return (
    <RowField label={label} hint={hint} error={error} visibleLabel>
      {(props) => (
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            variant="outline"
            label={fewerLabel}
            disabled={!canDecrease}
            onClick={() => onStep(-1)}
          >
            <MinusIcon aria-hidden="true" />
          </IconButton>
          <Input
            {...props}
            name="servings"
            inputMode="numeric"
            autoComplete="off"
            className="w-20 text-center tabular-nums"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <IconButton
            type="button"
            variant="outline"
            label={moreLabel}
            disabled={!canIncrease}
            onClick={() => onStep(1)}
          >
            <PlusIcon aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </RowField>
  );
}

/** Chips for one choice (difficulty) or several (seasons, diet), announced as a labelled group. */
function ChipGroup({
  label,
  hint,
  type,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  type: "single" | "multiple";
  value: string[];
  onChange: (values: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  const items = options.map((o) => (
    <ToggleGroupItem
      key={o.value}
      value={o.value}
      className="h-10 rounded-full! border-border px-4 data-[state=on]:border-primary-strong data-[state=on]:bg-primary data-[state=on]:text-primary-foreground pointer-coarse:h-11"
    >
      {o.label}
    </ToggleGroupItem>
  ));
  const common = {
    "aria-labelledby": id,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    variant: "outline" as const,
    spacing: 2,
    className: "flex-wrap",
  };
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      {type === "single" ? (
        // Radix sends "" when the active chip is clicked again; a single choice stays chosen.
        <ToggleGroup {...common} type="single" value={value[0] ?? ""} onValueChange={(v) => v && onChange([v])}>
          {items}
        </ToggleGroup>
      ) : (
        <ToggleGroup {...common} type="multiple" value={value} onValueChange={onChange}>
          {items}
        </ToggleGroup>
      )}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  );
}
