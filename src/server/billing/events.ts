import "server-only";

/**
 * Stripe events the webhook acts on; others are acknowledged and ignored.
 * The Stripe dashboard endpoint (docs/SETUP_KEYS.md §4) and `pnpm stripe:listen`
 * subscribe to exactly these.
 */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
] as const;
