"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition, type MouseEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { DISH_BOUNDS } from "@/lib/dishes";

/**
 * − 4 servings +. The count moves at once (taps add up even while the page
 * catches up); the amounts are scaled by the server. Plain links underneath,
 * so it works before JavaScript loads too.
 */
export function ServingsStepper({ basePath, servings }: { basePath: string; servings: number }) {
  const t = useTranslations("dishes");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(servings);
  const href = (n: number) => `${basePath}?servings=${n}`;

  const go = (n: number) => (event: MouseEvent) => {
    event.preventDefault();
    startTransition(() => {
      setShown(n);
      router.replace(href(n), { scroll: false });
    });
  };

  return (
    <div
      role="group"
      aria-label={t("page.servingsLabel")}
      aria-busy={pending || undefined}
      className="flex items-center gap-1"
    >
      <Step
        href={href(shown - 1)}
        label={t("page.fewerServings")}
        disabled={shown <= DISH_BOUNDS.servingsMin}
        onClick={go(shown - 1)}
      >
        <MinusIcon aria-hidden="true" />
      </Step>
      <p aria-live="polite" className="min-w-24 text-center text-sm font-medium tabular-nums">
        {t("servingsCount", { count: shown })}
      </p>
      <Step
        href={href(shown + 1)}
        label={t("page.moreServings")}
        disabled={shown >= DISH_BOUNDS.servingsMax}
        onClick={go(shown + 1)}
      >
        <PlusIcon aria-hidden="true" />
      </Step>
    </div>
  );
}

function Step({
  href,
  label,
  disabled,
  onClick,
  children,
}: {
  href: string;
  label: string;
  disabled: boolean;
  onClick: (event: MouseEvent) => void;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label} title={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="icon">
      <Link href={href} replace scroll={false} aria-label={label} title={label} onClick={onClick}>
        {children}
      </Link>
    </Button>
  );
}
