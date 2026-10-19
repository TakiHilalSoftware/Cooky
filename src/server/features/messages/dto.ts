// What the UI may know about conversations. Types only: safe for the UI.
import type { Course } from "@/lib/dishes";
import type { PersonDto, SharedDishCardDto } from "@/server/features/social/dto";

export type MessagePreviewDto = {
  kind: "text" | "dish" | "deleted";
  /** The start of the text, for "text" only. */
  text: string | null;
  fromMe: boolean;
  /** ISO time. */
  at: string;
};

export type ConversationSummaryDto = {
  id: string;
  person: PersonDto;
  last: MessagePreviewDto | null;
  unread: boolean;
  archived: boolean;
};

export type ConversationListDto = {
  conversations: ConversationSummaryDto[];
  /** Archived chats, shown behind a toggle. */
  archivedCount: number;
  showingArchived: boolean;
};

/** A dish card in a message. `available` is false once the reader can no longer open it. */
export type MessageDishDto = {
  id: string;
  name: string;
  course: Course;
  photoUrl: string | null;
  available: boolean;
};

export type MessageDto = {
  id: string;
  fromMe: boolean;
  /** null once deleted. */
  text: string | null;
  deleted: boolean;
  edited: boolean;
  at: string;
  dish: MessageDishDto | null;
  /** Your own messages only: how far it got. */
  status: "sent" | "delivered" | "seen" | null;
};

export type ThreadDto = {
  id: string;
  person: PersonDto;
  messages: MessageDto[];
  /** Older messages exist beyond `limit`. */
  hasEarlier: boolean;
  limit: number;
  /** False after an unfriend or a block: the chat is read-only. */
  canSend: boolean;
  archived: boolean;
  /** A few of their shared dishes, for the profile popup. */
  sharedDishes: SharedDishCardDto[];
};

/** Your dishes this friend can open, for "Attach a dish". */
export type AttachableDishDto = { id: string; name: string; course: Course; photoUrl: string | null };
