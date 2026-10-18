// Billing outcomes the UI explains. Types only: safe for the UI.

export type CheckoutResult =
  | { status: "redirect"; url: string; trial: boolean }
  /** Already paying: plan changes happen in the Customer Portal. */
  | { status: "already_subscribed" };

export type PortalResult = { url: string };
