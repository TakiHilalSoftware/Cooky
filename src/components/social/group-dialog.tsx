"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/forms/text-field";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useActionErrorHandler } from "@/components/paywall/upgrade-sheet-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { checkFields } from "@/lib/forms";
import { GROUP_NAME_MAX } from "@/lib/social";
import { createFriendGroup, updateFriendGroup } from "@/server/actions/sharing";
import type { FriendDto, FriendGroupDto } from "@/server/features/social/dto";
import { createGroupSchema } from "@/server/features/social/schema";

import { PersonAvatar } from "./person-avatar";

type GroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: FriendDto[];
  /** Edit this group; without it, a new one is created. */
  group?: FriendGroupDto;
};

/** A private list of friends (Family, Work…) to share dishes with. Members are never told. */
export function GroupDialog({ open, onOpenChange, friends, group }: GroupDialogProps) {
  const t = useTranslations("friends.groups");
  const tCommon = useTranslations("common");
  const messages = useFormMessages();
  const onActionError = useActionErrorHandler();
  const [name, setName] = useState(group?.name ?? "");
  const [members, setMembers] = useState<string[]>(group?.memberIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close(next: boolean) {
    if (!next) {
      setName(group?.name ?? "");
      setMembers(group?.memberIds ?? []);
      setError(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const check = checkFields(createGroupSchema, { name, memberIds: members });
    if (!check.ok) return setError(messages.field(check.errors.name));
    setPending(true);
    const result = group
      ? await updateFriendGroup({ id: group.id, ...check.data })
      : await createFriendGroup(check.data);
    setPending(false);
    if (result?.data) {
      toast.success(group ? t("saved", { name: check.data.name }) : t("created", { name: check.data.name }));
      return close(false);
    }
    if (result?.serverError === "conflict") return setError(t("nameTaken"));
    if (result?.serverError === "quota_exceeded") {
      close(false);
      return onActionError(result.serverError, "friend_groups");
    }
    setError(messages.action(result?.serverError));
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {group ? t("editTitle", { name: group.name }) : t("newTitle")}
            </DialogTitle>
            <DialogDescription>{t("dialogBody")}</DialogDescription>
          </DialogHeader>
          <TextField
            label={t("nameLabel")}
            name="name"
            placeholder={t("namePlaceholder")}
            maxLength={GROUP_NAME_MAX}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error}
          />
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">
              {t("membersLabel")}{" "}
              <span className="font-normal text-muted-foreground tabular-nums">
                ({t("chosen", { count: members.length })})
              </span>
            </legend>
            {friends.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                {t("noFriendsYet")}
              </p>
            ) : (
              <ul className="grid max-h-64 gap-1 overflow-y-auto pe-1">
                {friends.map((friend) => {
                  const id = `group-member-${friend.id}`;
                  const checked = members.includes(friend.id);
                  return (
                    <li key={friend.id}>
                      <Label
                        htmlFor={id}
                        className="flex min-h-12 items-center gap-3 rounded-xl px-2 font-normal hover:bg-muted"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(value) =>
                            setMembers((list) =>
                              value === true ? [...list, friend.id] : list.filter((m) => m !== friend.id),
                            )
                          }
                        />
                        <PersonAvatar person={friend} className="size-8" />
                        <span className="min-w-0 truncate">{friend.displayName}</span>
                      </Label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {group ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
