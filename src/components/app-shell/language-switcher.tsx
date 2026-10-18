"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAction } from "next-safe-action/hooks";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePathname, useRouter } from "@/i18n/navigation";
import { directionOf, routing } from "@/i18n/routing";
import { updateLocale } from "@/server/actions/settings";

import { useSavesPreferences } from "./preferences-sync";

/**
 * Lists each language in its own script ("Français", "العربية") so people can
 * find theirs whatever the current UI language is, and keeps the current page.
 */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const saves = useSavesPreferences();
  const save = useAction(updateLocale);

  function change(next: string) {
    const target = routing.locales.find((l) => l === next);
    if (!target || target === locale) return;
    // Signed in: emails and notifications follow the language in use.
    if (saves) save.execute({ locale: target });
    startTransition(() => router.replace(pathname, { locale: target }));
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              aria-label={`${t("label")}: ${t(`names.${locale}`)}`}
              aria-busy={isPending || undefined}
              className="min-w-9 gap-2 px-2.5 pointer-coarse:min-w-11"
            >
              <LanguagesIcon aria-hidden="true" />
              {/* Icon-only on phones. When shown, the visible name is part of the
                  accessible name (WCAG 2.5.3). */}
              <span lang={locale} className="hidden sm:inline">
                {t(`names.${locale}`)}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("tooltip")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l} dir={directionOf(l)} className="min-h-10">
              {t(`names.${l}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
