"use server";

import { returnServerError } from "next-safe-action";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import type { ActionErrorCode } from "@/lib/errors";
import { sniffAudio, transcribeAudio, TranscriptionUnavailable } from "@/server/ai/transcribe";
import { parseIngredientLine, splitIngredientText } from "@/server/features/dishes/ingredient-line";

import { meteredAction } from "./_clients";

/** ARCHITECTURE §5.9: recordings up to 4 MB (about a minute). */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const dictationSchema = z.instanceof(FormData);

/**
 * Voice dictation for ingredients (PRD §3.2, uses a voice try): audio in,
 * ingredient rows out. The try is given back when nothing was heard or the
 * service is unavailable.
 */
export const dictateIngredients = meteredAction("voice")
  .metadata({ actionName: "dictateIngredients" })
  .inputSchema(dictationSchema)
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
    const ingredients = splitIngredientText(text).map(parseIngredientLine).slice(0, 50);
    if (ingredients.length === 0) returnServerError<ActionErrorCode>("not_found");
    return { text, ingredients };
  });
