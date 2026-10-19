"use client";

import { CheckIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/feedback/icon-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { dismissChecklist } from "@/server/actions/checklist";
import type { ChecklistDto, ChecklistStep } from "@/server/features/checklist/dto";

const HREF: Record<ChecklistStep, "/dishes/new" | "/kitchen" | "/cook" | "/planner" | "/friends"> = {
  dishes: "/dishes/new",
  kitchen: "/kitchen",
  cook: "/cook",
  plan: "/planner",
  friend: "/friends",
};

/** The first-week checklist (PRD §3.1): five small wins, each a link to where it happens. Dismissible. */
export function FirstWeekChecklist({ checklist }: { checklist: ChecklistDto }) {
  const t = useTranslations("checklist");
  const messages = useFormMessages();
  const [hidden, setHidden] = useState(false);
  const done = checklist.steps.filter((s) => s.done).length;
  const total = checklist.steps.length;
  if (hidden) return null;

  async function hide() {
    setHidden(true);
    const result = await dismissChecklist({});
    if (!result?.data) {
      setHidden(false);
      toast.error(messages.action(result?.serverError));
    }
  }

  return (
    <section aria-labelledby="checklist-heading" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="checklist-heading" className="font-heading text-xl">
            {t("heading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <IconButton label={t("hide")} onClick={() => void hide()} className="-me-2 -mt-1">
          <XIcon aria-hidden="true" />
        </IconButton>
      </div>
      <div className="mt-4 space-y-1.5">
        <p className="text-sm font-medium tabular-nums">{t("progress", { done, total })}</p>
        <Progress value={(done / total) * 100} aria-label={t("progress", { done, total })} />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {checklist.steps.map(({ step, done: complete }) => (
          <li key={step}>
            <Link
              href={HREF[step]}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition-colors",
                complete
                  ? "border-transparent bg-muted text-muted-foreground"
                  : "border-border hover:border-primary-strong hover:bg-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  complete ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {complete ? <CheckIcon className="size-3.5" /> : null}
              </span>
              <span className={cn("min-w-0 flex-1", complete && "line-through decoration-1")}>{t(`step.${step}`)}</span>
              <span className="sr-only">{complete ? t("done") : t("todo")}</span>
              {complete ? null : (
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
