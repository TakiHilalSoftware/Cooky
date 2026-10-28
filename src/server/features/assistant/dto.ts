// What the UI may know about the Assistant. Types only: safe for the UI.
import type { UsageDto } from "@/server/features/billing/dto";

/** A dish card under a reply: one of the person's dishes, or a Discover recipe. */
export type AssistantPickDto =
  | {
      kind: "mine";
      dishId: string;
      name: string;
      why: string;
      photoUrl: string | null;
      /** What's missing from My kitchen. */
      missing: string[];
    }
  | {
      kind: "discover";
      slug: string;
      name: string;
      why: string;
      photoUrl: string | null;
      description: string;
      saved: boolean;
    };

export type AssistantMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  picks: AssistantPickDto[];
};

export type AssistantThreadDto = { id: string; title: string; updatedAt: string };

export type AssistantPageDto = {
  threads: AssistantThreadDto[];
  thread: { id: string; title: string; messages: AssistantMessageDto[] } | null;
  usage: UsageDto | null;
  /** False when no AI provider is configured: the page says so instead of failing on send. */
  available: boolean;
  voiceUsage: UsageDto | null;
};

export type AskAssistantResult = {
  threadId: string;
  question: AssistantMessageDto;
  answer: AssistantMessageDto;
};
