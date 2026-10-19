/**
 * Versions of the legal documents users accept at signup (PRD §3.1, consents
 * table). Bump a version when the document's text changes materially.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-10-19",
  privacy: "2026-10-19",
} as const;

/**
 * Who runs Cooky, for the imprint and the legal pages. Fill these in before
 * launch (docs/SETUP_KEYS.md, go-live checklist): the imprint shows only what's
 * set, and the legal pages name the operator once `name` is set.
 */
export const OPERATOR: {
  name: string | null;
  address: string | null;
  email: string | null;
  registration: string | null;
  vatId: string | null;
  director: string | null;
} = {
  name: null,
  address: null,
  email: null,
  registration: null,
  vatId: null,
  director: null,
};

/** Processors that handle personal data for Cooky (privacy policy, PRD §4). */
export const PROCESSORS = [
  { name: "Vercel", purpose: "hosting", location: "EU/US", url: "https://vercel.com/legal/privacy-policy" },
  { name: "Neon", purpose: "database", location: "EU", url: "https://neon.tech/privacy-policy" },
  { name: "Upstash", purpose: "jobs", location: "EU", url: "https://upstash.com/trust/privacy.pdf" },
  { name: "Cloudflare R2", purpose: "storage", location: "EU", url: "https://www.cloudflare.com/privacypolicy/" },
  { name: "Resend", purpose: "email", location: "US", url: "https://resend.com/legal/privacy-policy" },
  { name: "Stripe", purpose: "payments", location: "EU/US", url: "https://stripe.com/privacy" },
  { name: "Pusher", purpose: "realtime", location: "EU", url: "https://pusher.com/legal/privacy-policy" },
  { name: "Groq", purpose: "ai", location: "US", url: "https://groq.com/privacy-policy/" },
  { name: "OpenAI", purpose: "ai", location: "US", url: "https://openai.com/policies/privacy-policy" },
  { name: "Open-Meteo", purpose: "weather", location: "EU", url: "https://open-meteo.com/en/terms" },
  { name: "Sentry", purpose: "errors", location: "EU", url: "https://sentry.io/privacy/" },
  { name: "Google / Apple", purpose: "signin", location: "US", url: "https://policies.google.com/privacy" },
] as const;

export type ProcessorPurpose = (typeof PROCESSORS)[number]["purpose"];
