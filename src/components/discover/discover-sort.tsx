"use client";

import Form from "next/form";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FILTER_KEYS } from "@/lib/discover-url";
import { DISCOVER_SORTS, type DiscoverSort as Sort } from "@/lib/dishes";
import type { DiscoverFilters } from "@/server/features/discover/schema";

/**
 * "Sort by", beside the result count. A GET form like the filters: it keeps
 * them, starts the list from the top, and applies as soon as a choice is made.
 * "For you" is only offered with an account (it reads their kitchen).
 */
export function DiscoverSort({ filters, sort, signedIn }: { filters: DiscoverFilters; sort: Sort; signedIn: boolean }) {
  const t = useTranslations("discover.sort");
  const locale = useLocale();
  const id = useId();
  const options = DISCOVER_SORTS.filter((s) => s !== "for_you" || signedIn);
  return (
    <Form action={`/${locale}/discover`} replace scroll={false} className="flex items-center gap-2">
      {FILTER_KEYS.map((key) =>
        filters[key] ? <input key={key} type="hidden" name={key} value={filters[key]} /> : null,
      )}
      <label htmlFor={id} className="text-sm font-medium whitespace-nowrap">
        {t("label")}
      </label>
      <NativeSelect
        id={id}
        name="sort"
        defaultValue={sort}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-w-36"
      >
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {t(option)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <noscript>
        <button type="submit" className="text-sm font-medium text-primary-strong underline">
          {t("apply")}
        </button>
      </noscript>
    </Form>
  );
}
