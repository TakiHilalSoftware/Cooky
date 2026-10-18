import "server-only";

import { Resend } from "resend";

import { emailFromProblem, env } from "@/server/env";
import { logger } from "@/server/observability/logger";
import { PermanentJobError } from "@/server/outbox/errors";

import type { RenderedEmail } from "./render";

/** Resend errors that can succeed later; everything else needs a human fix. */
const RETRYABLE = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "concurrent_idempotent_requests",
  "application_error",
  "internal_server_error",
]);

let client: Resend | undefined;

/** Why email can't be sent with the current settings, or null when it can. */
export function emailSetupProblem(): string | null {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return "RESEND_API_KEY or EMAIL_FROM is not set.";
  return emailFromProblem(env.EMAIL_FROM);
}

/**
 * Sends through Resend. When email isn't set up correctly (local development
 * only; deployed builds refuse to boot) the email is logged instead, links
 * included, so every flow stays testable and nothing piles up as dead jobs.
 * Throws on failure so the outbox retries, or PermanentJobError when retrying
 * can't help (e.g. EMAIL_FROM on a domain Resend hasn't verified).
 */
export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  const problem = emailSetupProblem();
  if (problem || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    logger.warn(
      { reason: problem, to, subject: email.subject, text: email.text },
      "email not sent (development fallback)",
    );
    return;
  }
  client ??= new Resend(env.RESEND_API_KEY);
  const { error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (!error) return;
  const message = `resend ${error.name}: ${error.message}`;
  if (RETRYABLE.has(error.name)) throw new Error(message);
  throw new PermanentJobError(message);
}
