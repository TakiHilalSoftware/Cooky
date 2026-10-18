import { NextResponse } from "next/server";

import { getStripe } from "@/server/billing/stripe";
import { handleStripeEvent } from "@/server/billing/webhook";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

/**
 * Stripe webhooks (ARCHITECTURE §5.3): verify the signature on the raw body,
 * then apply the event. Errors return 500 so Stripe retries; replays are
 * recognised by event id and change nothing.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }
  const body = await request.text();

  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, "stripe webhook rejected: bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    logger.error({ err, eventId: event.id, type: event.type }, "stripe webhook failed");
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
