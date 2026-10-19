"use client";

import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";

/**
 * The top bar's messages icon with its unread dot (PRD §3.0). On phones the
 * bar has no room, so Messages lives under "More", which carries the dot.
 */
export function MessagesLink({ unread }: { unread: boolean }) {
  const t = useTranslations("nav");
  const label = unread ? `${t("messages")}, ${t("unread")}` : t("messages");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon" className="relative hidden sm:inline-flex">
          <Link href="/messages" aria-label={label}>
            <MessagesSquareIcon aria-hidden="true" />
            {unread ? (
              <span
                aria-hidden="true"
                className="absolute end-2 top-2 size-2.5 rounded-full bg-primary ring-2 ring-background"
              />
            ) : null}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
