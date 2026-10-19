"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useOnline } from "@/components/app-shell/use-online";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { useRouter } from "@/i18n/navigation";
import type { Relation } from "@/lib/social";
import { cancelFriendRequest, sendFriendRequest } from "@/server/actions/friends";
import { openConversation } from "@/server/actions/messages";
import type { PersonDto } from "@/server/features/social/dto";

/**
 * Add / cancel / message for one person, shown at once (optimistic) with the
 * server's answer winning. Accepting needs the request id, so it lives on the
 * request row instead.
 */
export function useRelation(person: Pick<PersonDto, "id" | "displayName" | "relation">) {
  const t = useTranslations("friends");
  const messages = useFormMessages();
  const online = useOnline();
  const router = useRouter();
  const [relation, setRelation] = useState<Relation>(person.relation);
  const [seen, setSeen] = useState(person.relation);
  if (seen !== person.relation) {
    setSeen(person.relation);
    setRelation(person.relation);
  }
  const [pending, setPending] = useState(false);

  async function run<T>(
    optimistic: Relation,
    call: () => Promise<{ data?: T; serverError?: unknown } | undefined>,
    onData: (data: T) => void,
  ) {
    if (!online) return toast.error(t("offline"));
    const before = relation;
    setRelation(optimistic);
    setPending(true);
    const result = await call();
    setPending(false);
    if (result?.data) return onData(result.data);
    setRelation(before);
    toast.error(result?.serverError === "rate_limited" ? t("tooManyRequests") : messages.action(result?.serverError));
  }

  return {
    relation,
    pending,
    add: () =>
      run(
        "outgoing",
        () => sendFriendRequest({ userId: person.id }),
        (data: { relation: Relation }) => {
          setRelation(data.relation);
          toast.success(
            data.relation === "friend"
              ? t("nowFriends", { name: person.displayName })
              : t("requestSent", { name: person.displayName }),
          );
        },
      ),
    cancel: () =>
      run(
        "none",
        () => cancelFriendRequest({ userId: person.id }),
        () => toast.success(t("requestCancelled")),
      ),
    message: async () => {
      if (!online) return toast.error(t("offline"));
      setPending(true);
      const result = await openConversation({ userId: person.id });
      setPending(false);
      if (result?.data) return router.push(`/messages/${result.data.conversationId}`);
      toast.error(messages.action(result?.serverError));
    },
  };
}
