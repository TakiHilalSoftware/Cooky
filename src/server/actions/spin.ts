"use server";

import { sql } from "drizzle-orm";
import { returnServerError } from "next-safe-action";

import type { ActionErrorCode } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import { spinSessions } from "@/server/db/schema";
import type { SpinResultDto } from "@/server/features/spin/dto";
import { drawSpin } from "@/server/features/spin/queries";
import { spinSchema } from "@/server/features/spin/schema";

import { meteredAction } from "./_clients";

/**
 * Spin the wheel (PRD §3.4, uses a spin): a weighted pick that never repeats
 * within the day. Nothing left to pick gives the spin back (not_found).
 */
export const spinDish = meteredAction("spins")
  .metadata({ actionName: "spinDish" })
  .inputSchema(spinSchema)
  .action(async ({ parsedInput: input, ctx }): Promise<SpinResultDto> => {
    const drawn = await drawSpin(ctx.user.id, input);
    if (!drawn) returnServerError<ActionErrorCode>("not_found");
    await getDb()
      .insert(spinSessions)
      .values({ userId: ctx.user.id, date: drawn.today, pickedDishIds: [drawn.result.dish.id], mode: input.mode })
      .onConflictDoUpdate({
        target: [spinSessions.userId, spinSessions.date],
        set: {
          pickedDishIds: sql`array_append(${spinSessions.pickedDishIds}, ${drawn.result.dish.id}::uuid)`,
          mode: input.mode,
        },
      });
    return drawn.result;
  });
