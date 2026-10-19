// Realtime events (ARCHITECTURE §5.11). Types only: safe for the UI.
// Events carry ids, never content: the client refreshes through the server.

export type RealtimeEvent =
  /** A new message arrived. */
  | { type: "message"; conversationId: string }
  /** A message was edited, deleted or restored: refresh, but nothing to announce. */
  | { type: "message_changed"; conversationId: string }
  /** The other side received or read messages. */
  | { type: "receipt"; conversationId: string }
  | { type: "typing"; conversationId: string }
  /** A friend request arrived or was accepted. */
  | { type: "friends" };

/** What the browser needs to open its own private channel. Null when realtime is off. */
export type RealtimeConfigDto = { key: string; cluster: string; channel: string } | null;
