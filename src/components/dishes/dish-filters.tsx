"use client";

import { SearchIcon, XIcon } from "lucide-react";
import Form from "next/form";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { COURSES, type Course } from "@/lib/dishes";

type DishFiltersProps = {
  q?: string;
  course?: Course;
  favorites: boolean;
  /** The collection being shown: searching stays inside it. */
  collection?: string;
};

/**
 * Search and filters live in the URL (shareable, Back works). A GET form
 * works before JavaScript loads; with it, changes apply at once and the
 * page updates without a reload.
 */
export function DishFilters({ q, course, favorites, collection }: DishFiltersProps) {
  const t = useTranslations("dishes");
  const searchId = useId();
  const courseId = useId();
  const favoritesId = useId();
  const locale = useLocale();
  const active = Boolean(q || course || favorites);
  const submit = (element: HTMLElement) => element.closest("form")?.requestSubmit();

  return (
    <Form
      action={`/${locale}/dishes`}
      replace
      scroll={false}
      role="search"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {collection ? <input type="hidden" name="collection" value={collection} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:basis-64">
        <label htmlFor={searchId} className="text-sm font-medium">
          {t("list.searchLabel")}
        </label>
        <div className="flex gap-2">
          <Input
            id={searchId}
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("list.searchPlaceholder")}
            maxLength={80}
            autoComplete="off"
          />
          <Button type="submit" variant="outline" className="shrink-0">
            <SearchIcon aria-hidden="true" data-icon="inline-start" />
            {t("list.search")}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={courseId} className="text-sm font-medium">
            {t("list.courseLabel")}
          </label>
          <NativeSelect
            id={courseId}
            name="course"
            defaultValue={course ?? ""}
            className="w-44"
            onChange={(e) => submit(e.currentTarget)}
          >
            <NativeSelectOption value="">{t("list.allCourses")}</NativeSelectOption>
            {COURSES.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {t(`course.${c}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex min-h-11 items-center gap-2.5">
          {/* A native checkbox, so it submits with the form ("favorites=1") even without JavaScript. */}
          <Checkbox
            id={favoritesId}
            name="favorites"
            value="1"
            defaultChecked={favorites}
            onCheckedChange={() => queueMicrotask(() => submit(document.getElementById(favoritesId)!))}
          />
          <label htmlFor={favoritesId} className="text-sm">
            {t("list.favoritesOnly")}
          </label>
        </div>
        {active ? (
          <Button asChild variant="ghost">
            <Link href={collection ? `/dishes?collection=${collection}` : "/dishes"} replace scroll={false}>
              <XIcon aria-hidden="true" data-icon="inline-start" />
              {t("list.clearFilters")}
            </Link>
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
