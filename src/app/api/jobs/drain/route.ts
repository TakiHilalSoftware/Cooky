import { NextResponse } from "next/server";

import { isAuthorizedJobCall } from "@/server/outbox/authorize";
import { drainOutbox } from "@/server/outbox/drain";

/** Outbox worker, called every minute by QStash (ARCHITECTURE §5.12). */
export async function POST(request: Request) {
  const body = await request.text();
  if (!(await isAuthorizedJobCall(request, body))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await drainOutbox({ limit: 50 });
  return NextResponse.json(result);
}
