import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { runBackupImport } from "@/server/features/backup/service";
import { profiles, user } from "@/server/db/schema";
import { renderEmail } from "@/server/notify/email/render";
import { sendEmail } from "@/server/notify/email/send";

import type { OutboxJob } from "./jobs";

export async function handleJob(job: OutboxJob): Promise<void> {
  switch (job.kind) {
    case "email":
      return sendTemplatedEmail(job.payload);
    case "backup_import":
      return runBackupImport(job.payload.importId);
  }
}

async function sendTemplatedEmail(payload: Extract<OutboxJob, { kind: "email" }>["payload"]) {
  if (!payload.url) throw new Error("email job has no link to send");
  // Language and name are read at send time, so the email follows the profile.
  const [recipient] = await getDb()
    .select({ name: user.name, displayName: profiles.displayName, locale: profiles.locale })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, payload.userId))
    .limit(1);
  if (!recipient) return; // Account deleted before delivery: nothing to send.

  const email = await renderEmail(payload.template, recipient.locale ?? "en", {
    name: recipient.displayName ?? recipient.name,
    url: payload.url,
  });
  await sendEmail(payload.to, email);
}
