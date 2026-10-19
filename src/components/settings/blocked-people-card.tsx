"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFormMessages } from "@/components/forms/use-form-messages";
import { PersonAvatar } from "@/components/social/person-avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { unblockUser } from "@/server/actions/friends";
import type { BlockedPersonDto } from "@/server/features/social/dto";

import { SettingsSection } from "./settings-section";

/** Blocked people (PRD §3.6): unblocking lets them find and add you again; it doesn't restore the friendship. */
export function BlockedPeopleCard({ people }: { people: BlockedPersonDto[] }) {
  const t = useTranslations("settings.privacy");
  const messages = useFormMessages();
  const [pending, setPending] = useState<string | null>(null);

  async function unblock(person: BlockedPersonDto) {
    setPending(person.id);
    const result = await unblockUser({ userId: person.id });
    setPending(null);
    if (result?.data) return toast.success(t("unblocked", { name: person.displayName }));
    toast.error(messages.action(result?.serverError));
  }

  return (
    <SettingsSection title={t("blockedHeading")} description={t("blockedDescription")}>
      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("noneBlocked")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 py-3">
              <PersonAvatar person={person} />
              <span className="min-w-0 flex-1 truncate font-medium">{person.displayName}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending !== null}
                onClick={() => void unblock(person)}
                aria-label={t("unblockLabel", { name: person.displayName })}
              >
                {pending === person.id ? <Spinner data-icon="inline-start" /> : null}
                {t("unblock")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
