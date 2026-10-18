import "server-only";

import { Resend } from "resend";

import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

import type { RenderedEmail } from "./render";

let client: Resend | undefined;

/**
 * Sends through Resend. Without an API key (local development only; deployed
 * builds require one) the email is logged instead, so flows stay testable.
 * Throws on provider failure so the outbox retries.
 */
export async function sendEmail(to: string, email: RenderedEmail): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    logger.warn({ subject: email.subject, text: email.text }, "email not sent: RESEND_API_KEY is not configured");
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
  if (error) throw new Error(`resend: ${error.name}`);
}
