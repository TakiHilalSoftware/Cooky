import "server-only";

import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";

import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

/** No provider is configured, or every one failed: the caller gives the try back. */
export class AssistantUnavailable extends Error {}

const TIMEOUT_MS = 25_000;

/** What the model must answer with (ARCHITECTURE §5.8): a short reply and up to three picks by alias. */
export const answerSchema = z.object({
  reply: z.string().max(1200),
  picks: z.array(z.object({ id: z.string().max(12), why: z.string().max(240) })).max(3),
});
export type ModelAnswer = z.infer<typeof answerSchema> & { tokensIn: number; tokensOut: number };

function models() {
  const list: { name: string; model: Parameters<typeof generateText>[0]["model"] }[] = [];
  if (env.GROQ_API_KEY) list.push({ name: "groq", model: createGroq({ apiKey: env.GROQ_API_KEY })(env.AI_CHAT_MODEL) });
  if (env.OPENAI_API_KEY) {
    list.push({ name: "openai", model: createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.AI_FALLBACK_MODEL) });
  }
  return list;
}

/**
 * Structured output with provider fallback: Groq first, OpenAI if Groq fails
 * (429/5xx, timeout, or an answer that doesn't fit the schema). No tools.
 */
export async function generateStructured<T extends z.ZodType>(
  name: string,
  schema: T,
  system: string,
  messages: ModelMessage[],
): Promise<{ output: z.infer<T>; tokensIn: number; tokensOut: number }> {
  const available = models();
  if (available.length === 0) throw new AssistantUnavailable("no chat provider configured");
  for (const provider of available) {
    try {
      const result = await generateText({
        model: provider.model,
        system,
        messages,
        output: Output.object({ name, schema }),
        temperature: 0.4,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return {
        output: result.output as z.infer<T>,
        tokensIn: result.usage.inputTokens ?? 0,
        tokensOut: result.usage.outputTokens ?? 0,
      };
    } catch (err) {
      // Provider text never reaches the browser; it's logged here only.
      logger.warn({ err, provider: provider.name, task: name }, "AI model failed; trying the next provider");
    }
  }
  throw new AssistantUnavailable("every chat provider failed");
}

/** One assistant turn (ARCHITECTURE §5.8). */
export async function askModel(system: string, messages: ModelMessage[]): Promise<ModelAnswer> {
  const { output, tokensIn, tokensOut } = await generateStructured("CookyAnswer", answerSchema, system, messages);
  return { ...output, tokensIn, tokensOut };
}
