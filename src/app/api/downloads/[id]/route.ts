import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { dataExports } from "@/server/db/schema";
import { verifyDownload } from "@/server/features/account/download";
import { readObject } from "@/server/storage/r2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A data export, for its owner only, through a signed link that expires (PRD §3.1). */
export async function GET(request: Request, { params }: RouteContext<"/api/downloads/[id]">) {
  const { id } = await params;
  const url = new URL(request.url);
  if (!UUID.test(id) || !verifyDownload(id, url.searchParams.get("e"), url.searchParams.get("s"))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [row] = await getDb()
    .select()
    .from(dataExports)
    .where(and(eq(dataExports.id, id), eq(dataExports.userId, session.user.id)))
    .limit(1);
  if (!row || row.status !== "ready" || !row.expiresAt || row.expiresAt < new Date()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const body = row.objectKey ? await readObject(row.objectKey) : row.content;
  if (!body) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const day = row.createdAt.toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="cooky-data-${day}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
