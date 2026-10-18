import "server-only";

import { timingSafeEqual } from "node:crypto";

import { Receiver } from "@upstash/qstash";

import { env } from "@/server/env";

let receiver: Receiver | undefined;

/**
 * Job endpoints accept two callers: QStash (signature-verified) and anything
 * holding CRON_SECRET as a bearer token (local runs, other schedulers).
 */
export async function isAuthorizedJobCall(request: Request, body: string): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (bearer && env.CRON_SECRET && safeEqual(bearer, env.CRON_SECRET)) return true;

  const signature = request.headers.get("upstash-signature");
  if (!signature || !env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) return false;
  receiver ??= new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });
  return receiver.verify({ signature, body }).catch(() => false);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
