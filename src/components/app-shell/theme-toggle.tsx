"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useTheme } from "next-themes";

import { IconButton } from "@/components/feedback/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, type ThemePreference } from "@/lib/appearance";
import { updateAppearance } from "@/server/actions/settings";

import { useSavesPreferences } from "./preferences-sync";

const THEME_OPTIONS = [
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
  { value: "system", icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const saves = useSavesPreferences();
  const save = useAction(updateAppearance);

  function choose(value: string) {
    const next = THEMES.find((option): option is ThemePreference => option === value);
    if (!next) return;
    setTheme(next);
    // Signed in: remember it on the profile, so other devices follow.
    if (saves) save.execute({ theme: next });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t("tooltip")}>
          {/* Both icons render; CSS picks one, so server and client markup match. */}
          <SunIcon aria-hidden="true" className="dark:hidden" />
          <MoonIcon aria-hidden="true" className="hidden dark:block" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={choose}>
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-10">
              <Icon aria-hidden="true" />
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
