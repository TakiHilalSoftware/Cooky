// What the UI may know about other people. Types only: safe for the UI.
// Never an email address, never a raw row: a person is a name and a photo.
import type { Course, Difficulty } from "@/lib/dishes";
import type { DishVisibility, NotificationKind, Relation } from "@/lib/social";

export type PersonDto = {
  id: string;
  displayName: string;
  initials: string;
  /** Signed link to the small profile photo. */
  avatarUrl: string | null;
  /** Where they stand with the viewer. */
  relation: Relation;
};

export type FriendDto = PersonDto & {
  /** ISO time the friendship started. */
  since: string;
};

export type FriendRequestDto = {
  id: string;
  person: PersonDto;
  /** ISO time it was sent. */
  sentAt: string;
};

export type FriendGroupDto = {
  id: string;
  name: string;
  /** Current friends only: people who left stop counting at once. */
  memberIds: string[];
};

export type GroupAllowanceDto = { count: number; limit: number | null; canAdd: boolean };

export type FriendsPageDto = {
  friends: FriendDto[];
  incoming: FriendRequestDto[];
  outgoing: FriendRequestDto[];
  groups: FriendGroupDto[];
  groupAllowance: GroupAllowanceDto;
};

/** A dish someone shared with the viewer. */
export type SharedDishCardDto = {
  id: string;
  name: string;
  course: Course;
  difficulty: Difficulty;
  servings: number;
  photoUrl: string | null;
};

export type FriendProfileDto = {
  person: PersonDto;
  /** ISO time you became friends; null when you aren't (yet). */
  since: string | null;
  dishes: SharedDishCardDto[];
  page: number;
  hasMore: boolean;
  /** Their total of dishes shared with the viewer. */
  sharedCount: number;
  /** Existing chat with them, if any. */
  conversationId: string | null;
};

export type BlockedPersonDto = { id: string; displayName: string; initials: string; avatarUrl: string | null };

/** How the owner shares a dish. */
export type DishSharingDto = {
  visibility: DishVisibility;
  groupIds: string[];
  groups: { id: string; name: string; memberCount: number }[];
  friendCount: number;
};

/** A friend's dish as the viewer sees it on the dish page. */
export type DishOwnerDto = { person: PersonDto };

/** Badge counts for the app shell. */
export type SocialBadgesDto = {
  /** Incoming requests since the last visit to Friends. */
  newRequests: number;
  /** Any conversation with something unread. */
  unreadMessages: boolean;
};

/** Settings → Notifications. */
export type NotificationSettingsDto = {
  /** Types switched off; everything else is on. */
  off: NotificationKind[];
  /** Push is set up on the server; null key = push isn't available at all. */
  vapidPublicKey: string | null;
};
