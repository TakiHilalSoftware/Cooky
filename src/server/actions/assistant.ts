"use server";

import { and, desc, eq } from "drizzle-orm";
import { returnServerError } from "next-safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import type { ActionErrorCode } from "@/lib/errors";
import { AssistantUnavailable, askModel } from "@/server/ai/chat";
import { sniffAudio, transcribeAudio, TranscriptionUnavailable } from "@/server/ai/transcribe";
import { getDb } from "@/server/db/client";
import { assistantMessages, assistantThreads } from "@/server/db/schema";
import { buildAssistantContext } from "@/server/features/assistant/context";
import type { AskAssistantResult } from "@/server/features/assistant/dto";
import { findOwnThread, hydratePicks } from "@/server/features/assistant/queries";
import { askAssistantSchema, threadIdSchema } from "@/server/features/assistant/schema";
import { threadTitle, toPicks } from "@/server/features/assistant/service";

import { meteredAction, userAction } from "./_clients";

/** Earlier turns the model sees, so follow-ups ("something lighter?") make sense. A turn is saved in one
 * transaction (same created_at), so the time-ordered UUID v7 id breaks the tie. */
const HISTORY_TURNS = 10;
/** ARCHITECTURE §5.9: recordings up to 4 MB (about a minute). */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/**
 * Ask the Assistant (PRD §3.4, uses an assistant try). The reply suggests
 * only real dishes; if no provider can answer, the try is given back.
 */
export const askAssistant = meteredAction("assistant")
  .metadata({ actionName: "askAssistant" })
  .inputSchema(askAssistantSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<AskAssistantResult> => {
    const userId = ctx.user.id;
    const thread = input.threadId ? await findOwnThread(userId, input.threadId) : null;
    if (input.threadId && !thread) returnServerError<ActionErrorCode>("not_found");

    const history = thread
      ? (
          await getDb()
            .select({ role: assistantMessages.role, content: assistantMessages.content })
            .from(assistantMessages)
            .where(eq(assistantMessages.threadId, thread.id))
            .orderBy(desc(assistantMessages.createdAt), desc(assistantMessages.id))
            .limit(HISTORY_TURNS)
        ).reverse()
      : [];

    const { system, aliases } = await buildAssistantContext(userId, input.locale, [
      ...history.filter((m) => m.role === "user").map((m) => m.content),
      input.text,
    ]);

    let answer: Awaited<ReturnType<typeof askModel>>;
    try {
      answer = await askModel(system, [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: input.text },
      ]);
    } catch (err) {
      if (err instanceof AssistantUnavailable) returnServerError<ActionErrorCode>("unavailable");
      throw err;
    }
    const picks = toPicks(answer.picks, aliases);

    const saved = await getDb().transaction(async (tx) => {
      const threadId =
        thread?.id ??
        (
          await tx
            .insert(assistantThreads)
            .values({ userId, title: threadTitle(input.text) })
            .returning({ id: assistantThreads.id })
        )[0]!.id;
      const [question] = await tx
        .insert(assistantMessages)
        .values({ threadId, role: "user", content: input.text })
        .returning({ id: assistantMessages.id });
      const [reply] = await tx
        .insert(assistantMessages)
        .values({
          threadId,
          role: "assistant",
          content: answer.reply.trim(),
          picks,
          tokensIn: answer.tokensIn,
          tokensOut: answer.tokensOut,
        })
        .returning({ id: assistantMessages.id });
      // Bumps the thread to the top of the list (and resets its 90-day clock).
      await tx.update(assistantThreads).set({ updatedAt: new Date() }).where(eq(assistantThreads.id, threadId));
      return { threadId, questionId: question!.id, replyId: reply!.id };
    });

    const [cards = []] = await hydratePicks(userId, input.locale, [picks]);
    revalidatePath("/[locale]/assistant", "layout");
    return {
      threadId: saved.threadId,
      question: { id: saved.questionId, role: "user", content: input.text, picks: [] },
      answer: { id: saved.replyId, role: "assistant", content: answer.reply.trim(), picks: cards },
    };
  });

/** Deletes a conversation for good (PRD §3.4: history is deletable). */
export const deleteAssistantThread = userAction
  .metadata({ actionName: "deleteAssistantThread" })
  .inputSchema(threadIdSchema)
  .action(async ({ parsedInput: { id }, ctx }) => {
    const [removed] = await getDb()
      .delete(assistantThreads)
      .where(and(eq(assistantThreads.id, id), eq(assistantThreads.userId, ctx.user.id)))
      .returning({ id: assistantThreads.id });
    if (!removed) returnServerError<ActionErrorCode>("not_found");
    revalidatePath("/[locale]/assistant", "layout");
    return removed;
  });

/** Ask by voice (uses a voice try): the recording becomes text in the message box, to check before sending. */
export const transcribeQuestion = meteredAction("voice")
  .metadata({ actionName: "transcribeQuestion" })
  .inputSchema(z.instanceof(FormData))
  .action(async ({ parsedInput: form }) => {
    const audio = form.get("audio");
    const locale = routing.locales.find((l) => l === form.get("locale")) ?? routing.defaultLocale;
    if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      returnServerError<ActionErrorCode>("invalid");
    }
    const bytes = new Uint8Array(await audio.arrayBuffer());
    if (!sniffAudio(bytes)) returnServerError<ActionErrorCode>("invalid");
    let text: string;
    try {
      text = await transcribeAudio(bytes, locale);
    } catch (err) {
      if (err instanceof TranscriptionUnavailable) returnServerError<ActionErrorCode>("unavailable");
      throw err;
    }
    if (!text) returnServerError<ActionErrorCode>("not_found");
    return { text: text.slice(0, 500) };
  });
