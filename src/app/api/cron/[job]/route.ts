import { NextResponse } from "next/server";

import { reconcileBilling } from "@/server/billing/reconcile";
import { purgeDueAccounts } from "@/server/features/account/deletion";
import { pruneAssistantHistory } from "@/server/features/assistant/queries";
import { purgeDeleted } from "@/server/features/dishes/cleanup";
import { isAuthorizedJobCall } from "@/server/outbox/authorize";
import { cleanupExpired } from "@/server/outbox/maintenance";
import { releaseStaleReservations } from "@/server/quota/tries";

/** Scheduled maintenance, called by QStash (ARCHITECTURE §5.12). */
const JOBS = {
  "billing-reconcile": () => reconcileBilling(),
  "release-reservations": async () => ({ released: await releaseStaleReservations() }),
  "purge-deleted": async () => ({
    purged: await purgeDeleted(),
    // Retention (PRD §4): assistant conversations untouched for 90 days.
    assistantThreads: await pruneAssistantHistory(),
  }),
  // PRD §3.1: accounts whose 7-day grace ended (DB rows, stored files, Stripe customer).
  "purge-accounts": () => purgeDueAccounts(),
  // Expired sessions and tokens, expired export files, old delivered jobs.
  cleanup: () => cleanupExpired(),
} as const;

export async function POST(request: Request, { params }: RouteContext<"/api/cron/[job]">) {
  const body = await request.text();
  if (!(await isAuthorizedJobCall(request, body))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { job } = await params;
  const run = Object.hasOwn(JOBS, job) ? JOBS[job as keyof typeof JOBS] : null;
  if (!run) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  return NextResponse.json(await run());
}
