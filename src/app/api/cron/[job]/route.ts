import { NextResponse } from "next/server";

import { reconcileBilling } from "@/server/billing/reconcile";
import { isAuthorizedJobCall } from "@/server/outbox/authorize";
import { releaseStaleReservations } from "@/server/quota/tries";

/** Scheduled maintenance, called by QStash (ARCHITECTURE §5.12). */
const JOBS = {
  "billing-reconcile": () => reconcileBilling(),
  "release-reservations": async () => ({ released: await releaseStaleReservations() }),
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
