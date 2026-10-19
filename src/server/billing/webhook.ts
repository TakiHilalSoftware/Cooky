import "server-only";

import { eq } from "drizzle-orm";

import { audit } from "@/server/audit/audit";
import { getDb, type Executor } from "@/server/db/client";
import { stripeEvents, subscriptions, user } from "@/server/db/schema";
import { env } from "@/server/env";
import type { EmailTemplate } from "@/server/notify/email/render";
import { queuePush } from "@/server/notify/queue";
import { drainSoon, enqueue } from "@/server/outbox/enqueue";

import { recomputeEntitlement } from "./entitlements";
import { HANDLED_EVENTS } from "./events";
import { getStripe, type Stripe } from "./stripe";
import { syncSubscription } from "./sync";

const billingUrl = () => `${env.NEXT_PUBLIC_APP_URL}/settings/billing`;

function subscriptionIdOf(event: Stripe.Event): string | null {
  const object = event.data.object as { object?: string };
  if (object.object === "subscription") return (event.data.object as Stripe.Subscription).id;
  if (object.object === "checkout.session") {
    const sub = (event.data.object as Stripe.Checkout.Session).subscription;
    return typeof sub === "string" ? sub : (sub?.id ?? null);
  }
  if (object.object === "invoice") {
    const sub = (event.data.object as Stripe.Invoice).parent?.subscription_details?.subscription;
    return typeof sub === "string" ? sub : (sub?.id ?? null);
  }
  return null;
}

/** A lifecycle email, with a matching push on devices that have push on (PRD §3.7). */
async function email(tx: Executor, userId: string, template: BillingTemplate, url: string) {
  const [owner] = await tx.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (!owner) return;
  await enqueue(tx, { kind: "email", payload: { template, userId, to: owner.email, url } });
  await queuePush(tx, userId, template, {}, "/settings/billing");
}

type BillingTemplate = Extract<EmailTemplate, "trialEnding" | "paymentFailed" | "cancellationConfirmed" | "receipt">;

/**
 * Applies one verified Stripe event (ARCHITECTURE §5.3). Fresh data is fetched
 * from Stripe first; then, in one transaction, the event id is recorded (so a
 * replay is a no-op), the subscription mirrored, the entitlement recomputed,
 * and emails queued. If anything throws, nothing is kept and Stripe retries.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return "ignored";

  const subscriptionId = subscriptionIdOf(event);
  // Deleted subscriptions can still be retrieved; always prefer Stripe's current state.
  const fresh = subscriptionId ? await getStripe().subscriptions.retrieve(subscriptionId) : null;

  const outcome = await getDb().transaction(async (tx) => {
    const [first] = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (!first) return "duplicate" as const;
    if (!fresh) return "processed" as const;

    // Mirror first: the invoice may be the first event we see for this subscription.
    const synced = await syncSubscription(fresh, tx);
    if (!synced) return "processed" as const;
    const { userId, before, after } = synced;

    if (event.type === "invoice.payment_failed" && !after.paymentFailedAt) {
      // Grace starts at the first failure, not at each retry.
      await tx.update(subscriptions).set({ paymentFailedAt: new Date() }).where(eq(subscriptions.id, fresh.id));
    }
    if (event.type === "invoice.paid") {
      await tx.update(subscriptions).set({ paymentFailedAt: null }).where(eq(subscriptions.id, fresh.id));
    }

    const change = await recomputeEntitlement(userId, tx);
    if (change.from !== change.to) {
      await audit(tx, {
        actorId: userId,
        action: "billing.plan_changed",
        targetType: "subscription",
        targetId: after.id,
        meta: { from: change.from, to: change.to, status: after.status, event: event.type },
      });
    }

    // Lifecycle emails (PRD §3.7).
    if (event.type === "customer.subscription.trial_will_end") await email(tx, userId, "trialEnding", billingUrl());
    if (event.type === "invoice.payment_failed") await email(tx, userId, "paymentFailed", billingUrl());
    if (after.cancelAtPeriodEnd && !before?.cancelAtPeriodEnd) {
      await email(tx, userId, "cancellationConfirmed", billingUrl());
    }
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.amount_paid > 0 && invoice.hosted_invoice_url) {
        await email(tx, userId, "receipt", invoice.hosted_invoice_url);
      }
    }
    return "processed" as const;
  });

  if (outcome === "processed") drainSoon();
  return outcome;
}
