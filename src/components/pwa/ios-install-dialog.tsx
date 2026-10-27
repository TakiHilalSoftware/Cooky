"use client";

import { CheckCircle2Icon, ShareIcon, SquarePlusIcon } from "lucide-react";
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

type IosInstallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Step-by-step guidance for iOS/iPadOS users.
 * Apple forbids triggering web app installation via JavaScript, so this modal
 * explains the native Safari workflow with clear visual cues.
 */
export function IosInstallDialog({ open, onOpenChange }: IosInstallDialogProps) {
  const t = useTranslations("install.iosDialog");

  const steps = [
    {
      num: 1,
      title: t("step1Title"),
      desc: t("step1Description"),
      icon: <ShareIcon className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />,
    },
    {
      num: 2,
      title: t("step2Title"),
      desc: t("step2Description"),
      icon: <SquarePlusIcon className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />,
    },
    {
      num: 3,
      title: t("step3Title"),
      desc: t("step3Description"),
      icon: <CheckCircle2Icon className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />,
    },
  ];

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

        <ol className="space-y-3">
          {steps.map((step) => (
            <li
              key={step.num}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-xs text-primary-foreground">
                {step.num}
              </span>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  {step.icon}
                  <span>{step.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
