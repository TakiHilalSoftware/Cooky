"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type KeyboardEvent } from "react";

import { unwrap } from "@/components/query/action-query";
import { queryKeys } from "@/components/query/keys";
import { useDebouncedValue } from "@/components/query/use-debounced-value";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { suggestIngredients } from "@/server/actions/ingredients";
import type { IngredientSuggestionDto } from "@/server/features/ingredients/dto";

/** Wait this long after the last keystroke before asking the server. */
const DEBOUNCE_MS = 180;

/** Case- and accent-blind "starts with", only to decide which suggestion to highlight. */
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

type IngredientNameFieldProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "role"> & {
  value: string;
  onChange: (value: string) => void;
  /** A suggestion was chosen (e.g. to fill in its usual unit). */
  onPick?: (suggestion: IngredientSuggestionDto) => void;
};

/**
 * The ingredient name input with autocomplete (PRD §3.2): an ARIA combobox.
 * ↑/↓ move through suggestions, Enter or Tab accept the highlighted one, Esc
 * closes. Only a suggestion that starts with what was typed is highlighted on
 * its own, so Tab never replaces something the person wrote themselves.
 */
export function IngredientNameField({ value, onChange, onPick, className, ...inputProps }: IngredientNameFieldProps) {
  const t = useTranslations("dishes.form");
  const locale = useLocale() as AppLocale;
  const listId = useId();
  // What the person typed (not what a pick filled in), so choosing a suggestion doesn't look it up again.
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const query = useDebouncedValue(typed.trim(), DEBOUNCE_MS);
  const { data } = useQuery({
    queryKey: queryKeys.ingredients(locale, query),
    queryFn: async () => unwrap(await suggestIngredients({ query, locale })),
    enabled: query.length > 0,
    // The dictionary barely changes: typing a word again answers from memory.
    staleTime: 5 * 60_000,
    // The last list stays up while the next word is looked up, so it doesn't flicker.
    placeholderData: keepPreviousData,
  });
  const suggestions = query && typed.trim() ? (data ?? []) : [];
  const shown = open && suggestions.length > 0;

  // A new list highlights its first entry only when it starts with what was typed.
  const [active, setActive] = useState(-1);
  const [activeFor, setActiveFor] = useState(data);
  if (activeFor !== data) {
    setActiveFor(data);
    setActive(data?.[0] && fold(data[0].name).startsWith(fold(query)) ? 0 : -1);
  }

  function pick(suggestion: IngredientSuggestionDto) {
    setTyped("");
    onChange(suggestion.name);
    onPick?.(suggestion);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!shown) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
    } else if ((event.key === "Enter" || event.key === "Tab") && active >= 0) {
      // Enter would submit the form; Tab keeps moving focus after accepting.
      if (event.key === "Enter") event.preventDefault();
      pick(suggestions[active]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const activeId = shown && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <div className="relative">
      <Input
        {...inputProps}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={t("suggestionsLabel")}
        hidden={!shown}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.source}-${suggestion.name}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Keep focus in the input; the click then picks.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(suggestion)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-sm",
              index === active ? "bg-secondary" : "hover:bg-muted",
            )}
          >
            <span className="truncate">{suggestion.name}</span>
            {suggestion.source === "yours" ? (
              <span className="shrink-0 text-xs text-muted-foreground">{t("yourIngredient")}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {shown ? t("suggestionsCount", { count: suggestions.length }) : ""}
      </p>
    </div>
  );
}
