"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { usePathname, useRouter } from "@/i18n/navigation";
import { getConversationSender, markMessagesDelivered } from "@/server/actions/messages";

import { useRealtime } from "./realtime-provider";

/**
 * App-wide reactions to realtime events: badges refresh, new messages count
 * as delivered, and a message for another chat shows an in-app toast (the
 * service worker skips the system notification while Cooky is focused).
 */
export function RealtimeShell() {
  const t = useTranslations("messages");
  const router = useRouter();
  const pathname = usePathname();

  useRealtime((event) => {
    if (event.type === "friends") return router.refresh();
    // An edit or delete only matters to the inbox's previews (the open thread refreshes itself).
    if (event.type === "message_changed") return pathname === "/messages" ? router.refresh() : undefined;
    if (event.type !== "message") return;
    // The open thread handles its own messages.
    if (pathname === `/messages/${event.conversationId}`) return;
    void markMessagesDelivered({});
    router.refresh();
    void getConversationSender({ conversationId: event.conversationId }).then((result) => {
      if (!result?.data?.name) return;
      toast(t("newFrom", { name: result.data.name }), {
        id: `message-${event.conversationId}`,
        action: { label: t("open"), onClick: () => router.push(`/messages/${event.conversationId}`) },
      });
    });
  });
  return null;
}
