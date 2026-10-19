"use client";

import { SearchIcon, XIcon } from "lucide-react";
import Form from "next/form";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Link } from "@/i18n/navigation";
import { COURSES, DIETARY_TAGS } from "@/lib/dishes";
import type { DiscoverFilters as Filters } from "@/server/features/discover/schema";

/**
 * Discover's filters live in the URL. A GET form: works before JavaScript
 * loads; with it, picking from a list applies at once.
 */
/**
 * Country names arrive from the server, already in the viewer's language:
 * browsers and Node ship different region names (e.g. for PS), and naming
 * them in the browser would make the two renders disagree.
 */
export function DiscoverFilters({
  filters,
  countries,
}: {
  filters: Filters;
  countries: { code: string; name: string }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const ids = { country: useId(), course: useId(), diet: useId(), have: useId(), hint: useId() };
  const submit = (element: HTMLElement) => element.closest("form")?.requestSubmit();
  const active = Boolean(filters.country || filters.course || filters.diet || filters.have || filters.collection);

  return (
    <Form action={`/${locale}/discover`} replace scroll={false} role="search" className="space-y-4">
      {filters.collection ? <input type="hidden" name="collection" value={filters.collection} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.country} className="text-sm font-medium">
            {t("discover.countryLabel")}
          </label>
          <NativeSelect
            id={ids.country}
            name="country"
            defaultValue={filters.country ?? ""}
            className="w-full"
            onChange={(e) => submit(e.currentTarget)}
          >
            <NativeSelectOption value="">{t("discover.allCountries")}</NativeSelectOption>
            {countries.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.course} className="text-sm font-medium">
            {t("discover.courseLabel")}
          </label>
          <NativeSelect
            id={ids.course}
            name="course"
            defaultValue={filters.course ?? ""}
            className="w-full"
            onChange={(e) => submit(e.currentTarget)}
          >
            <NativeSelectOption value="">{t("discover.allCourses")}</NativeSelectOption>
            {COURSES.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {t(`dishes.course.${c}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.diet} className="text-sm font-medium">
            {t("discover.dietLabel")}
          </label>
          <NativeSelect
            id={ids.diet}
            name="diet"
            defaultValue={filters.diet ?? ""}
            className="w-full"
            onChange={(e) => submit(e.currentTarget)}
          >
            <NativeSelectOption value="">{t("discover.allDiets")}</NativeSelectOption>
            {DIETARY_TAGS.map((d) => (
              <NativeSelectOption key={d} value={d}>
                {t(`dishes.diet.${d}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.have} className="text-sm font-medium">
          {t("discover.haveLabel")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={ids.have}
            name="have"
            defaultValue={filters.have}
            placeholder={t("discover.havePlaceholder")}
            maxLength={200}
            autoComplete="off"
            aria-describedby={ids.hint}
            className="min-w-0 flex-1 basis-56"
          />
          <Button type="submit" variant="outline">
            <SearchIcon aria-hidden="true" data-icon="inline-start" />
            {t("discover.apply")}
          </Button>
          {active ? (
            <Button asChild variant="ghost">
              <Link href="/discover" replace scroll={false}>
                <XIcon aria-hidden="true" data-icon="inline-start" />
                {t("discover.clear")}
              </Link>
            </Button>
          ) : null}
        </div>
        <p id={ids.hint} className="text-xs text-muted-foreground">
          {t("discover.haveHint")}
        </p>
      </div>
    </Form>
  );
}
