"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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

  function change(next: string) {
    const target = routing.locales.find((l) => l === next);
    if (!target || target === locale) return;
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
              className="gap-2 px-2.5"
            >
              <LanguagesIcon aria-hidden="true" />
              {/* The visible name is part of the accessible name (WCAG 2.5.3). */}
              <span lang={locale}>{t(`names.${locale}`)}</span>
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
