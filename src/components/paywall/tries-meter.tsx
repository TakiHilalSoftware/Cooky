import { InfinityIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { usePlanCopy } from "@/components/billing/use-plan-copy";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UsageDto } from "@/server/features/billing/dto";

/** PRD §3.10: "Tries left" stays low-key until this many remain. */
export const LOW_TRIES = 3;

type Level = "unlimited" | "unavailable" | "empty" | "low" | "ok";

function levelOf(usage: UsageDto): Level {
  const { limit, remaining } = usage;
  if (limit === null || remaining === null) return "unlimited";
  if (limit === 0) return "unavailable";
  if (remaining === 0) return "empty";
  return isLow(usage) ? "low" : "ok";
}

/** Running low: few left and some already spent (3 of 3 on a small allowance isn't "low"). */
export function isLow({ limit, remaining }: Pick<UsageDto, "limit" | "remaining">): boolean {
  return limit !== null && remaining !== null && remaining <= LOW_TRIES && remaining < limit;
}

type TriesMeterProps = {
  usage: UsageDto;
  /** full: a card with a bar and the reset date (Plan & billing). compact: one quiet line next to a feature. */
  variant?: "full" | "compact";
  /** Usually a "Get more" button. */
  action?: ReactNode;
  className?: string;
};

/**
 * "7 of 10 left", fed only by server values (AGENT_RULES §5): the browser
 * never counts tries itself.
 */
export function TriesMeter({ usage, variant = "full", action, className }: TriesMeterProps) {
  const t = useTranslations("tries");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const copy = usePlanCopy();
  const level = levelOf(usage);
  const name = copy.featureName(usage.feature);

  if (variant === "compact") {
    if (level === "unlimited") return null;
    return (
      <p
        data-level={level}
        className={cn(
          "text-sm tabular-nums",
          level === "ok" && "text-muted-foreground",
          level === "low" && "font-medium text-primary-strong",
          (level === "empty" || level === "unavailable") && "font-medium text-destructive",
          className,
        )}
      >
        {level === "unavailable" ? t("notOnPlan") : t("compact", { remaining: usage.remaining ?? 0 })}
      </p>
    );
  }

  const value =
    level === "unlimited"
      ? t("unlimited")
      : level === "unavailable"
        ? t("notOnPlan")
        : level === "empty"
          ? t("noneLeft")
          : t("left", { remaining: usage.remaining ?? 0, limit: usage.limit ?? 0 });
  const resetsAt = usage.resetsAt ? new Date(usage.resetsAt) : null;
  const percent = usage.limit ? Math.round(((usage.remaining ?? 0) / usage.limit) * 100) : 0;

  return (
    <div
      data-level={level}
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium">{name}</p>
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium tabular-nums",
            level === "low" && "text-primary-strong",
            (level === "empty" || level === "unavailable") && "text-destructive",
            level === "unlimited" && "text-muted-foreground",
          )}
        >
          {level === "unlimited" ? <InfinityIcon aria-hidden="true" className="size-4" /> : null}
          {value}
        </p>
      </div>
      {level === "unlimited" || level === "unavailable" ? null : (
        <Progress
          value={percent}
          aria-label={t("meterLabel", { feature: name })}
          getValueLabel={() => value}
          className={cn("h-2", level === "empty" && "bg-destructive/15")}
        />
      )}
      <p className="text-xs text-pretty text-muted-foreground">{copy.featureDescription(usage.feature)}</p>
      {resetsAt || action ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {resetsAt && level !== "unlimited" ? (
            <p className="text-xs text-muted-foreground">
              <time
                dateTime={usage.resetsAt ?? undefined}
                title={format.dateTime(resetsAt, { dateStyle: "full", timeStyle: "short" })}
              >
                {usage.period === "day"
                  ? t("resetsIn", { time: format.relativeTime(resetsAt, now) })
                  : t("resetsOn", { date: format.dateTime(resetsAt, { dateStyle: "medium" }) })}
              </time>
            </p>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
    </div>
  );
}
