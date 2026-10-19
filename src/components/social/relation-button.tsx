"use client";

import { ClockIcon, MessageSquareIcon, UserPlusIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import type { PersonDto } from "@/server/features/social/dto";

import { useRelation } from "./use-relation";

type RelationButtonProps = {
  person: Pick<PersonDto, "id" | "displayName" | "relation">;
  size?: ComponentProps<typeof Button>["size"];
};

/**
 * The one next step with someone: Add friend, Requested (tap to cancel),
 * Answer their request, or Message a friend. Each says what it does in a tooltip.
 */
export function RelationButton({ person, size = "sm" }: RelationButtonProps) {
  const t = useTranslations("friends");
  const { relation, pending, add, cancel, message } = useRelation(person);
  const icon = (Icon: LucideIcon) =>
    pending ? <Spinner data-icon="inline-start" /> : <Icon aria-hidden="true" data-icon="inline-start" />;

  if (relation === "self") return null;
  if (relation === "incoming") {
    // Accept/decline happens on the request itself (Friends → Requests).
    return (
      <Button asChild size={size}>
        <Link href="/friends#requests">
          <UserPlusIcon aria-hidden="true" data-icon="inline-start" />
          {t("answerRequest")}
        </Link>
      </Button>
    );
  }

  const [label, hint, action, variant, Icon] =
    relation === "friend"
      ? [t("message"), t("messageHint", { name: person.displayName }), message, "default" as const, MessageSquareIcon]
      : relation === "outgoing"
        ? [t("requested"), t("cancelHint"), cancel, "outline" as const, ClockIcon]
        : [t("addFriend"), t("addHint", { name: person.displayName }), add, "default" as const, UserPlusIcon];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size={size} variant={variant} disabled={pending} onClick={() => void action()}>
          {icon(Icon)}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
