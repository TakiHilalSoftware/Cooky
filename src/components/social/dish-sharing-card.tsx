"use client";

import { LockIcon, UsersRoundIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { DISH_VISIBILITIES, type DishVisibility } from "@/lib/social";
import { setDishSharing } from "@/server/actions/sharing";
import type { DishSharingDto } from "@/server/features/social/dto";

const ICONS = { private: LockIcon, friends: UsersRoundIcon, groups: UsersIcon } as const;

/** Who can see a dish (PRD §3.2): only me, all friends, or chosen groups. */
export function DishSharingCard({ dishId, sharing }: { dishId: string; sharing: DishSharingDto }) {
  const t = useTranslations("sharing");
  const messages = useFormMessages();
  const online = useOnline();
  const [visibility, setVisibility] = useState<DishVisibility>(sharing.visibility);
  const [groupIds, setGroupIds] = useState<string[]>(sharing.groupIds);
  const [pending, setPending] = useState(false);
  const [seen, setSeen] = useState(sharing);
  if (seen !== sharing) {
    setSeen(sharing);
    setVisibility(sharing.visibility);
    setGroupIds(sharing.groupIds);
  }

  const dirty =
    visibility !== sharing.visibility ||
    (visibility === "groups" &&
      (groupIds.length !== sharing.groupIds.length || groupIds.some((id) => !sharing.groupIds.includes(id))));
  const needsGroup = visibility === "groups" && groupIds.length === 0;

  async function save() {
    if (!online) return toast.error(t("offline"));
    setPending(true);
    const result = await setDishSharing({ dishId, visibility, groupIds: visibility === "groups" ? groupIds : [] });
    setPending(false);
    if (result?.data) return toast.success(t(`saved.${result.data.visibility}`));
    toast.error(messages.action(result?.serverError));
  }

  return (
    <section
      aria-labelledby="sharing-heading"
      className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="sharing-heading" className="font-heading text-xl">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <RadioGroup
        aria-labelledby="sharing-heading"
        value={visibility}
        onValueChange={(value) => {
          const picked = DISH_VISIBILITIES.find((v) => v === value);
          if (picked) setVisibility(picked);
        }}
      >
        {DISH_VISIBILITIES.map((option) => {
          const Icon = ICONS[option];
          return (
            <Label
              key={option}
              className="flex min-h-12 items-start gap-3 rounded-2xl border border-border p-3 font-normal has-[[data-state=checked]]:border-primary-strong"
            >
              <RadioGroupItem value={option} className="mt-0.5" />
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="space-y-0.5">
                <span className="block font-medium">{t(`option.${option}`)}</span>
                <span className="block text-xs text-muted-foreground">
                  {option === "friends" ? t("friendsHint", { count: sharing.friendCount }) : t(`optionHint.${option}`)}
                </span>
              </span>
            </Label>
          );
        })}
      </RadioGroup>

      {visibility === "groups" ? (
        sharing.groups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            {t.rich("noGroups", {
              link: (chunks) => (
                <Link href="/friends" className="font-medium text-foreground underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : (
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">{t("pickGroups")}</legend>
            {sharing.groups.map((group) => {
              const id = `share-group-${group.id}`;
              return (
                <Label
                  key={group.id}
                  htmlFor={id}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 font-normal hover:bg-muted"
                >
                  <Checkbox
                    id={id}
                    checked={groupIds.includes(group.id)}
                    onCheckedChange={(value) =>
                      setGroupIds((list) => (value === true ? [...list, group.id] : list.filter((g) => g !== group.id)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t("memberCount", { count: group.memberCount })}
                  </span>
                </Label>
              );
            })}
            {needsGroup ? <p className="text-xs text-muted-foreground">{t("pickOne")}</p> : null}
          </fieldset>
        )
      ) : null}

      {dirty ? (
        <Button onClick={() => void save()} disabled={pending || needsGroup}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {t("save")}
        </Button>
      ) : null}
    </section>
  );
}
