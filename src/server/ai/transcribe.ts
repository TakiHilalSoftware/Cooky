import "server-only";

import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { transcribe } from "ai";

import type { AppLocale } from "@/i18n/routing";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

/** No provider is configured, or every one failed: the caller gives the try back. */
export class TranscriptionUnavailable extends Error {}

const TIMEOUT_MS = 25_000;

/** A sample in the person's language steers spelling and units ("500 g", not "five hundred grams"). */
const STYLE: Record<AppLocale, string> = {
  en: "Ingredients: 2 potatoes, 500 g of chicken, 1 tsp cumin and salt.",
  fr: "Ingrédients : 2 pommes de terre, 500 g de poulet, 1 c. à c. de cumin et du sel.",
  ar: "المكونات: حبتا بطاطس، 500 غرام دجاج، ملعقة صغيرة كمون وملح.",
};

function providers() {
  const list: { name: string; run: (audio: Uint8Array, locale: AppLocale) => Promise<string> }[] = [];
  if (env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    list.push({
      name: "groq",
      run: async (audio, locale) =>
        (
          await transcribe({
            model: groq.transcription(env.AI_TRANSCRIBE_MODEL),
            audio,
            providerOptions: { groq: { language: locale, prompt: STYLE[locale] } },
            abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          })
        ).text,
    });
  }
  if (env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    list.push({
      name: "openai",
      run: async (audio, locale) =>
        (
          await transcribe({
            model: openai.transcription("whisper-1"),
            audio,
            providerOptions: { openai: { language: locale, prompt: STYLE[locale] } },
            abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          })
        ).text,
    });
  }
  return list;
}

/**
 * Speech to text (ARCHITECTURE §5.9): Groq first, OpenAI if Groq fails.
 * Returns the trimmed text (possibly empty: nothing was heard).
 */
export async function transcribeAudio(audio: Uint8Array, locale: AppLocale): Promise<string> {
  const available = providers();
  if (available.length === 0) throw new TranscriptionUnavailable("no transcription provider configured");
  for (const provider of available) {
    try {
      return (await provider.run(audio, locale)).trim();
    } catch (err) {
      // Provider text never reaches the browser; it's logged here only.
      logger.warn({ err, provider: provider.name }, "transcription failed; trying the next provider");
    }
  }
  throw new TranscriptionUnavailable("every transcription provider failed");
}

/** Audio formats browsers record, recognised by their first bytes (the declared type isn't trusted). */
export function sniffAudio(bytes: Uint8Array): "webm" | "ogg" | "mp4" | "wav" | "mp3" | null {
  const at = (offset: number, ...values: number[]) => values.every((v, i) => bytes[offset + i] === v);
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "webm";
  if (at(0, 0x4f, 0x67, 0x67, 0x53)) return "ogg";
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return "mp4";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x41, 0x56, 0x45)) return "wav";
  if (at(0, 0x49, 0x44, 0x33) || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)) return "mp3";
  return null;
}
