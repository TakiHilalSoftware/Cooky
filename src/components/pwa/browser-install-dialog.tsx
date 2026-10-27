"use client";

import { CompassIcon, LaptopIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { CookyIcon } from "@/components/brand/cooky-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BrowserInstallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Universal installation guidance when browser automated prompts are unavailable or in cooldown.
 * Clearly directs users to their browser's built-in install controls so they are never stranded.
 */
export function BrowserInstallDialog({ open, onOpenChange }: BrowserInstallDialogProps) {
  const t = useTranslations("install.browserDialog");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CookyIcon className="size-6 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">{t("title")}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">{t("description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
              <LaptopIcon className="size-4" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-foreground">Chrome, Edge & Brave</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("chromeTip")}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
              <CompassIcon className="size-4" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-medium text-foreground">Safari</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("safariTip")}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
