"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useInstallPrompt } from "./install-provider";

type InstallButtonProps = {
  /** Visual appearance: icon for top bars, menuitem for dropdown menus, or button with text. */
  variant?: "icon" | "menuitem" | "button";
  /** Button size when variant is 'button'. */
  size?: "default" | "sm" | "lg";
  /** Optional extra classes. */
  className?: string;
  /** Force rendering even if install prompt isn't detected yet (e.g. settings page). */
  showAlways?: boolean;
};

/**
 * Universal trigger for installing Cooky.
 * Automatically switches between native prompt (Chrome/Android) and iOS Safari visual guide.
 * Completely hides itself if Cooky is already installed or running in standalone mode.
 */
export function InstallButton({
  variant = "icon",
  size = "default",
  className,
  showAlways = false,
}: InstallButtonProps) {
  const t = useTranslations("install");
  const { canInstall, isInstalled, promptToInstall } = useInstallPrompt();

  if (isInstalled) return null;
  if (!canInstall && !showAlways) return null;

  const handleClick = () => {
    void promptToInstall();
  };

  if (variant === "menuitem") {
    return (
      <DropdownMenuItem onSelect={handleClick} className={cn("gap-2", className)}>
        <DownloadIcon className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />
        <span>{t("button")}</span>
      </DropdownMenuItem>
    );
  }

  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className={cn("rounded-lg text-muted-foreground hover:text-foreground", className)}
            aria-label={t("tooltip")}
          >
            <DownloadIcon className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("tooltip")}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" size={size} onClick={handleClick} className={cn("gap-2", className)}>
      <DownloadIcon className="size-4 shrink-0" aria-hidden="true" />
      <span>{t("button")}</span>
    </Button>
  );
}
