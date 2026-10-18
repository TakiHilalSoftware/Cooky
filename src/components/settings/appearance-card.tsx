"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";

import { ChoiceGroup, type Choice } from "@/components/forms/choice-group";
import {
  ACCENTS,
  TEXT_SIZES,
  THEMES,
  type Accent,
  type Appearance,
  type TextSize,
  type ThemePreference,
} from "@/lib/appearance";
import { updateAppearance } from "@/server/actions/settings";

import { SettingsSection } from "./settings-section";

const THEME_ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;
const SAMPLE_SIZE = { s: "text-sm", m: "text-base", l: "text-lg", xl: "text-xl" } as const;

/**
 * Accent, theme and text size. Each change shows at once (optimistic), saves
 * to the profile, and is undone with an explanation if saving fails.
 */
export function AppearanceCard({ initial }: { initial: Appearance }) {
  const t = useTranslations("settings.appearance");
  const tTheme = useTranslations("theme");
  const { setTheme } = useTheme();
  const [current, setCurrent] = useState(initial);
  const [savedKey, setSavedKey] = useState(0);
  const save = useAction(updateAppearance);

  /** Applies a change to the page itself, without waiting for the server. */
  function apply(next: Appearance) {
    const root = document.documentElement;
    root.dataset.accent = next.accent;
    root.dataset.textSize = next.textSize;
    setTheme(next.theme);
    setCurrent(next);
  }

  async function change(patch: Partial<Appearance>) {
    const previous = current;
    apply({ ...current, ...patch });
    const result = await save.executeAsync(patch);
    if (result.serverError || result.validationErrors) {
      apply(previous);
      toast.error(t("saveFailed"));
    } else {
      setSavedKey((k) => k + 1);
    }
  }

  const accentChoices: Choice<Accent>[] = ACCENTS.map((accent) => ({
    value: accent,
    label: t(`accents.${accent}`),
    visual: (
      <span data-swatch={accent} className="block">
        <span className="block size-7 rounded-full bg-primary ring-1 ring-foreground/10" />
      </span>
    ),
  }));

  const themeChoices: Choice<ThemePreference>[] = THEMES.map((theme) => {
    const Icon = THEME_ICON[theme];
    return { value: theme, label: tTheme(theme), visual: <Icon className="size-5" /> };
  });

  const sizeChoices: Choice<TextSize>[] = TEXT_SIZES.map((size) => ({
    value: size,
    label: t(`sizes.${size}`),
    visual: <span className={`${SAMPLE_SIZE[size]} font-heading leading-none`}>Aa</span>,
  }));

  return (
    <SettingsSection
      title={t("heading")}
      description={t("description")}
      aside={
        savedKey > 0 ? (
          <p key={savedKey} role="status" className="flex items-center gap-1 text-sm text-muted-foreground">
            <CheckIcon aria-hidden="true" className="size-4 text-primary-strong" />
            {t("saved")}
          </p>
        ) : null
      }
    >
      <div className="space-y-6">
        <ChoiceGroup
          legend={t("accentLabel")}
          value={current.accent}
          onValueChange={(accent) => change({ accent })}
          choices={accentChoices}
          className="grid-cols-4 sm:grid-cols-7"
        />
        <ChoiceGroup
          legend={t("themeLabel")}
          value={current.theme}
          onValueChange={(theme) => change({ theme })}
          choices={themeChoices}
          className="grid-cols-3"
        />
        <ChoiceGroup
          legend={t("textSizeLabel")}
          value={current.textSize}
          onValueChange={(textSize) => change({ textSize })}
          choices={sizeChoices}
          className="grid-cols-2 sm:grid-cols-4"
        />
        <p className="rounded-2xl bg-muted p-4 text-pretty">{t("preview")}</p>
      </div>
    </SettingsSection>
  );
}
