import { buildFeed, feedOwner } from "@/server/features/calendar-feed/queries";

/**
 * The Pro iCal feed (PRD §3.5, ARCHITECTURE: route handlers for iCal). The
 * secret token is the only credential; a revoked link or a plan without the
 * feed answers 404, the same as a link that never existed.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  const { token } = await params;
  const owner = await feedOwner(token);
  if (!owner) return new Response("Not found", { status: 404 });
  return new Response(await buildFeed(owner), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="cooky.ics"',
      "cache-control": "private, max-age=300",
    },
  });
}
