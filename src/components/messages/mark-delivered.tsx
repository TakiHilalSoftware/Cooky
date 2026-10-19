"use client";

import { useEffect } from "react";

import { markMessagesDelivered } from "@/server/actions/messages";

/** Opening the inbox means new messages reached this device: senders see "delivered". */
export function MarkDelivered() {
  useEffect(() => {
    void markMessagesDelivered({});
  }, []);
  return null;
}
