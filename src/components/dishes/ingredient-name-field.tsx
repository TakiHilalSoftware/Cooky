"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
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
  const locale = useLocale();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<IngredientSuggestionDto[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function lookUp(text: string) {
    clearTimeout(timer.current);
    const query = text.trim();
    if (!query) {
      request.current++;
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++request.current;
      const result = await suggestIngredients({ query, locale });
      // A slower, older answer must not replace a newer one.
      if (id !== request.current) return;
      const found = result?.data ?? [];
      setSuggestions(found);
      setOpen(found.length > 0);
      setActive(found[0] && fold(found[0].name).startsWith(fold(query)) ? 0 : -1);
    }, DEBOUNCE_MS);
  }

  function pick(suggestion: IngredientSuggestionDto) {
    request.current++;
    onChange(suggestion.name);
    onPick?.(suggestion);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
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

  const activeId = open && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <div className="relative">
      <Input
        {...inputProps}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          lookUp(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={t("suggestionsLabel")}
        hidden={!open}
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
        {open ? t("suggestionsCount", { count: suggestions.length }) : ""}
      </p>
    </div>
  );
}
