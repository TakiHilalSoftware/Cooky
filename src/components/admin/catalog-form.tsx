"use client";

import { ChevronLeftIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { IconButton } from "@/components/feedback/icon-button";
import { ChipGroup } from "@/components/forms/chip-group";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { CATALOG_COLLECTIONS, COURSES, DIETARY_TAGS, DIFFICULTIES, SEASONS, UNITS } from "@/lib/dishes";
import { cn } from "@/lib/utils";
import { adminDeleteCatalogDish, adminSaveCatalogDish } from "@/server/actions/admin";
import type { CatalogDishFormDto, CatalogTexts } from "@/server/features/admin/dto";

const LANGS = ["en", "fr", "ar"] as const;
const emptyTexts = (): CatalogTexts => ({ en: "", fr: "", ar: "" });

const EMPTY_CATALOG_DISH: CatalogDishFormDto = {
  id: null,
  slug: "",
  country: "",
  course: "main",
  difficulty: "easy",
  servings: 4,
  seasons: [],
  dietaryTags: [],
  collections: [],
  featured: false,
  name: emptyTexts(),
  description: emptyTexts(),
  ingredients: [{ amount: null, unit: null, name: emptyTexts(), note: emptyTexts() }],
  steps: [{ text: emptyTexts(), timerMinutes: null }],
};

const pick = <T extends string>(all: readonly T[], values: string[]) => all.filter((v) => values.includes(v));

/**
 * Create or edit a Discover dish (PRD §3.8). Every text in English (required),
 * French and Arabic; a missing translation is flagged and falls back to English.
 */
export function CatalogForm({ initial = EMPTY_CATALOG_DISH }: { initial?: CatalogDishFormDto }) {
  const t = useTranslations("admin.catalog");
  const tDishes = useTranslations("dishes");
  const tDiscover = useTranslations("discover");
  const messages = useFormMessages();
  const router = useRouter();
  const [dish, setDish] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof CatalogDishFormDto>(key: K, value: CatalogDishFormDto[K]) =>
    setDish((d) => ({ ...d, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await adminSaveCatalogDish(dish);
    setPending(false);
    if (result?.data) {
      toast.success(t("saved", { name: dish.name.en }));
      if (!dish.id) router.replace(`/admin/catalog/${result.data.id}`);
      return;
    }
    setError(
      result?.serverError === "conflict"
        ? t("slugTaken")
        : result?.validationErrors
          ? t("checkFields")
          : messages.action(result?.serverError),
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <Link
        href="/admin/catalog"
        className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("back")}
      </Link>
      <h2 className="font-heading text-3xl">{dish.id ? t("editTitle", { name: initial.name.en }) : t("newTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("formHint")}</p>

      <Card title={t("basics")}>
        <TextsField label={t("name")} value={dish.name} onChange={(v) => set("name", v)} required max={120} />
        <TextsField
          label={t("descriptionField")}
          value={dish.description}
          onChange={(v) => set("description", v)}
          required
          max={600}
          multiline
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("slug")} hint={t("slugHint")}>
            {(id) => (
              <Input
                id={id}
                value={dish.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase())}
                maxLength={60}
                dir="ltr"
                required
              />
            )}
          </Field>
          <Field label={t("country")} hint={t("countryHint")}>
            {(id) => (
              <Input
                id={id}
                value={dish.country}
                onChange={(e) => set("country", e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                dir="ltr"
                required
                className="w-24 uppercase"
              />
            )}
          </Field>
          <Field label={t("course")}>
            {(id) => (
              <NativeSelect
                id={id}
                value={dish.course}
                onChange={(e) => set("course", COURSES.find((c) => c === e.target.value) ?? "main")}
              >
                {COURSES.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {tDishes(`course.${c}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t("servings")}>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={dish.servings}
                onChange={(e) => set("servings", Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="w-28"
              />
            )}
          </Field>
        </div>
        <ChipGroup
          label={t("difficulty")}
          type="single"
          value={[dish.difficulty]}
          onChange={(v) => set("difficulty", pick(DIFFICULTIES, v)[0] ?? dish.difficulty)}
          options={DIFFICULTIES.map((d) => ({ value: d, label: tDishes(`difficulty.${d}`) }))}
        />
        <ChipGroup
          label={t("seasons")}
          type="multiple"
          value={dish.seasons}
          onChange={(v) => set("seasons", pick(SEASONS, v))}
          options={SEASONS.map((s) => ({ value: s, label: tDishes(`season.${s}`) }))}
        />
        <ChipGroup
          label={t("diet")}
          type="multiple"
          value={dish.dietaryTags}
          onChange={(v) => set("dietaryTags", pick(DIETARY_TAGS, v))}
          options={DIETARY_TAGS.map((d) => ({ value: d, label: tDishes(`diet.${d}`) }))}
        />
        <ChipGroup
          label={t("collections")}
          type="multiple"
          value={dish.collections}
          onChange={(v) => set("collections", pick(CATALOG_COLLECTIONS, v))}
          options={CATALOG_COLLECTIONS.map((c) => ({ value: c, label: tDiscover(`collection.${c}`) }))}
        />
        <Label className="flex min-h-11 items-center gap-3 font-normal">
          <Checkbox checked={dish.featured} onCheckedChange={(v) => set("featured", v === true)} />
          {t("featured")}
        </Label>
      </Card>

      <Card title={t("ingredients")}>
        <ol className="space-y-4">
          {dish.ingredients.map((line, i) => (
            <li key={i} className="space-y-3 rounded-2xl border border-border p-3">
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t("amount")}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="decimal"
                      className="w-24"
                      value={line.amount ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(",", "."));
                        const ingredients = [...dish.ingredients];
                        ingredients[i] = { ...line, amount: e.target.value.trim() && n > 0 ? n : null };
                        set("ingredients", ingredients);
                      }}
                    />
                  )}
                </Field>
                <Field label={t("unit")}>
                  {(id) => (
                    <NativeSelect
                      id={id}
                      value={line.unit ?? ""}
                      onChange={(e) => {
                        const ingredients = [...dish.ingredients];
                        ingredients[i] = { ...line, unit: UNITS.find((u) => u === e.target.value) ?? null };
                        set("ingredients", ingredients);
                      }}
                    >
                      <NativeSelectOption value="">{t("noUnit")}</NativeSelectOption>
                      {UNITS.map((u) => (
                        <NativeSelectOption key={u} value={u}>
                          {tDishes(`unitName.${u}`)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <IconButton
                  label={t("removeIngredient", { n: i + 1 })}
                  className="ms-auto"
                  disabled={dish.ingredients.length === 1}
                  onClick={() =>
                    set(
                      "ingredients",
                      dish.ingredients.filter((_, j) => j !== i),
                    )
                  }
                >
                  <XIcon aria-hidden="true" />
                </IconButton>
              </div>
              <TextsField
                label={t("ingredientName", { n: i + 1 })}
                value={line.name}
                max={80}
                required
                onChange={(name) => {
                  const ingredients = [...dish.ingredients];
                  ingredients[i] = { ...line, name };
                  set("ingredients", ingredients);
                }}
              />
              <TextsField
                label={t("ingredientNote")}
                value={line.note}
                max={120}
                onChange={(note) => {
                  const ingredients = [...dish.ingredients];
                  ingredients[i] = { ...line, note };
                  set("ingredients", ingredients);
                }}
              />
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          disabled={dish.ingredients.length >= 60}
          onClick={() =>
            set("ingredients", [
              ...dish.ingredients,
              { amount: null, unit: null, name: emptyTexts(), note: emptyTexts() },
            ])
          }
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {t("addIngredient")}
        </Button>
      </Card>

      <Card title={t("steps")}>
        <ol className="space-y-4">
          {dish.steps.map((step, i) => (
            <li key={i} className="space-y-3 rounded-2xl border border-border p-3">
              <div className="flex items-end gap-3">
                <Field label={t("timer")}>
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={1440}
                      className="w-28"
                      value={step.timerMinutes ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const steps = [...dish.steps];
                        steps[i] = { ...step, timerMinutes: n >= 1 ? Math.min(1440, Math.round(n)) : null };
                        set("steps", steps);
                      }}
                    />
                  )}
                </Field>
                <IconButton
                  label={t("removeStep", { n: i + 1 })}
                  className="ms-auto"
                  onClick={() =>
                    set(
                      "steps",
                      dish.steps.filter((_, j) => j !== i),
                    )
                  }
                >
                  <XIcon aria-hidden="true" />
                </IconButton>
              </div>
              <TextsField
                label={t("stepText", { n: i + 1 })}
                value={step.text}
                max={2000}
                required
                multiline
                onChange={(text) => {
                  const steps = [...dish.steps];
                  steps[i] = { ...step, text };
                  set("steps", steps);
                }}
              />
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          disabled={dish.steps.length >= 40}
          onClick={() => set("steps", [...dish.steps, { text: emptyTexts(), timerMinutes: null }])}
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          {t("addStep")}
        </Button>
      </Card>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {dish.id ? t("save") : t("create")}
        </Button>
        {dish.id ? (
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden="true" data-icon="inline-start" />
            {t("delete")}
          </Button>
        ) : null}
      </div>
      {dish.id ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("deleteTitle", { name: initial.name.en })}
          description={t("deleteBody")}
          confirmLabel={t("delete")}
          onConfirm={async () => {
            const result = await adminDeleteCatalogDish({ id: dish.id! });
            if (!result?.data) {
              toast.error(messages.action(result?.serverError));
              return false;
            }
            toast.success(t("deleted", { name: initial.name.en }));
            router.replace("/admin/catalog");
          }}
        />
      ) : null}
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-heading text-xl">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** One text in three languages. English is required; a missing translation is flagged. */
function TextsField({
  label,
  value,
  onChange,
  required = false,
  multiline = false,
  max,
}: {
  label: string;
  value: CatalogTexts;
  onChange: (value: CatalogTexts) => void;
  required?: boolean;
  multiline?: boolean;
  max: number;
}) {
  const t = useTranslations("admin.catalog");
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid gap-2 lg:grid-cols-3">
        {LANGS.map((lang) => {
          const fieldId = `${id}-${lang}`;
          const missing = lang !== "en" && required && value.en.trim() !== "" && value[lang].trim() === "";
          const Control = multiline ? Textarea : Input;
          return (
            <div key={lang} className="space-y-1">
              <Label htmlFor={fieldId} className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                {t(`lang.${lang}`)}
                {lang === "en" && required ? <span>({t("required")})</span> : null}
                {missing ? <Badge variant="outline">{t("missingShort")}</Badge> : null}
              </Label>
              <Control
                id={fieldId}
                dir={lang === "ar" ? "rtl" : "ltr"}
                lang={lang}
                maxLength={max}
                value={value[lang]}
                required={lang === "en" && required}
                rows={multiline ? 3 : undefined}
                className={cn(missing && "border-dashed")}
                onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
