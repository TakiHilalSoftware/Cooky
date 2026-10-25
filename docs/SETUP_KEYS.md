# Turning on integrations: keys checklist

All variables are declared and validated in `src/server/env.ts` (`@t3-oss/env-nextjs`). **The app refuses to build or boot in production if a required variable is missing or malformed.** "Production" here means a deployed build (`VERCEL_ENV=preview|production`). A local `pnpm build` stays usable without accounts; set `COOKY_STRICT_ENV=1` to rehearse the deployed check locally. Optional integrations turn their feature off cleanly when unset (the UI says "unavailable", never an error). Document every variable in `.env.example`, copy it to `.env.local` for development, and set production values in **Vercel → Settings → Environment Variables** (separate values for *Preview* and *Production*).

| # | Integration | Turns on | Server variables | Client variables | Prod | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Neon Postgres | Everything | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | — | ✅ | Free tier → paid |
| 2 | App & auth | Sessions, links, jobs | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CRON_SECRET` | `NEXT_PUBLIC_APP_URL` | ✅ | — |
| 3 | Google / Apple sign-in | One-tap signup | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET` | — | ✅ Google · optional Apple | Free · Apple needs the developer program |
| 4 | Stripe | Plans, trials, invoices | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | — | ✅ | % per transaction |
| 5 | Upstash Redis | Burst limits, weather cache | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | — | ✅ | Free tier |
| 6 | Upstash QStash | Outbox, schedules, timer alerts | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | — | ✅ | Free tier |
| 7 | Resend | All email | `RESEND_API_KEY`, `EMAIL_FROM` | — | ✅ | Free 3k/mo |
| 8 | Cloudflare R2 | Photos, avatars, exports | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | — | ✅ | Free 10 GB, no egress |
| 9 | Pusher Channels | Live chat, typing, receipts | `PUSHER_APP_ID`, `PUSHER_SECRET` | `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | ✅ | Free sandbox → paid |
| 10 | Web Push | Notifications when closed | `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | Free |
| 11 | AI (AI SDK) | Assistant, voice, import fallback, Fill my week | `GROQ_API_KEY`, `OPENAI_API_KEY`, `AI_CHAT_MODEL`, `AI_FALLBACK_MODEL`, `AI_TRANSCRIBE_MODEL` | — | optional | Pay per use |
| 12 | Open-Meteo | Weather chip, ranking | `OPEN_METEO_API_KEY` | — | ✅ | Commercial plan |
| 13 | Sentry | Error tracking | `SENTRY_AUTH_TOKEN` (build only) | `NEXT_PUBLIC_SENTRY_DSN` | ✅ | Free tier |
| 14 | PostHog | Product analytics (server-side) | `POSTHOG_KEY`, `POSTHOG_HOST` | — | optional | Free tier |

**The client column is the complete list of variables that may reach the browser.** Anything else showing up client-side is a bug.

---

## 1. Neon Postgres
1. Create a project at [neon.tech](https://neon.tech) in the region of your Vercel functions. Enable point-in-time recovery and the **Vercel integration** (a database branch per preview deployment).
2. `DATABASE_URL` = pooled connection string (runtime). `DATABASE_URL_UNPOOLED` = direct string (migrations).
3. Enable the extensions in the first migration: `pg_trgm`, `unaccent`.
4. Run:
   ```sh
   pnpm db:migrate
   pnpm db:seed                    # plan limits, ingredient dictionary, Discover catalog
   pnpm admin:set you@example.com  # after signing up
   ```
✅ **Check:** `pnpm dev` → sign up → verify → finish onboarding → Discover shows dishes in EN/FR/AR.

## 2. App & auth secrets
- `BETTER_AUTH_SECRET`: `openssl rand -base64 48`. **Never rotate casually**: it signs auth cookies and tokens.
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`: the canonical https origin. Every email link and Stripe/OAuth return URL is built from it, never from the request.
- `CRON_SECRET`: `openssl rand -hex 32`, for any non-QStash scheduler calling `/api/cron/*`.
✅ **Check:** `pnpm build` fails immediately if any of these is missing.

## 3. Google / Apple sign-in
- **Google:** Cloud Console → OAuth consent screen (name, logo, privacy URL) → OAuth client (Web) with the redirect URI `https://<app>/api/auth/callback/google` (confirm the exact path in the current Better Auth docs).
- **Apple:** Services ID with Sign in with Apple, return URL `https://<app>/api/auth/callback/apple`, and a key (.p8) used to generate the client secret as Better Auth documents.
✅ **Check:** "Continue with Google" creates an account. Signing up later with the same verified email signs into it instead of creating a duplicate.

## 4. Stripe
1. Work in **Test mode** first.
2. `pnpm stripe:sync` creates or validates *Cooky Plus* / *Cooky Pro* with monthly and yearly EUR prices from `config/plans.ts`, using lookup keys (so no price ids in env). It's safe to rerun: a changed amount creates a new price that takes over the lookup key and archives the old one. A live key needs `--live`.
3. **Customer portal:** allow plan switch, cancel at period end, payment-method update, invoice history.
4. Turn on **Stripe Tax** and set the business address, then set `STRIPE_AUTOMATIC_TAX=on` (Checkout then collects the address and adds tax). Until then leave it `off`.
5. **Webhook** `https://<app>/api/webhooks/stripe` with these events: `checkout.session.completed`, `customer.subscription.created|updated|deleted|trial_will_end`, `invoice.paid`, `invoice.payment_failed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Local: install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then run `pnpm stripe:listen` next to `pnpm dev`. It uses the key in `.env.local` (so the CLI's own login doesn't matter) and forwards events to `NEXT_PUBLIC_APP_URL/api/webhooks/stripe`. Keep `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` on the port `pnpm dev` actually uses (Next picks 3001 when 3000 is taken): Checkout returns there and webhooks are sent there. Put the `whsec_…` secret it prints into `STRIPE_WEBHOOK_SECRET` once; it stays the same for that key.
7. **E2E (`e2e/billing.spec.ts`)** uses the test key from `.env.local` (or the `STRIPE_TEST_SECRET_KEY` repo secret in CI) and the prices from step 2. It never fills Stripe's hosted pages: it checks that Cooky opens a real Checkout session, then plays the customer through the API on **test clocks** (trial end, renewal, a declined card), signs the events Stripe generated with `STRIPE_WEBHOOK_SECRET` and posts them to the server under test. Clocks, and the customers on them, are deleted afterwards; test accounts use `@example.invalid` addresses. Without a test key the journeys are skipped.

✅ **Check:**
- Upgrade with card `4242 4242 4242 4242`. Within seconds Settings → Plan shows **Plus** and the Assistant shows 150 tries.
- Resend the same event from the dashboard. Nothing changes (idempotent).
- Cancel in the portal. The plan stays until the period ends, then Free, and dishes over 50 become read-only.
- Card `4000 0000 0000 0341` → payment-failed email, then the grace period.
- A second trial on the same account is refused.

## 5. Upstash Redis
Create a Redis database in the same region and copy the REST URL and token.
✅ **Check:** sending 31 chat messages within a minute → the 31st returns "too fast".

## 6. Upstash QStash
Copy the token and both signing keys, then run `pnpm jobs:schedule` (or `pnpm jobs:schedule https://your-domain`). It registers, idempotently: outbox drain (every minute), stale try release (every 5 minutes), cleanup of expired sessions, tokens and export files (hourly), purge of deleted dishes and old assistant threads (daily), account purge after the 7-day grace (daily), Stripe reconcile (daily).
✅ **Check:** request a password reset → the `outbox` row goes `pending → done` and the email arrives. In the QStash console, the six `cooky-*` schedules point at the production URL.

## 7. Resend
Verify the sending domain (SPF, DKIM, DMARC) and set `RESEND_API_KEY` and `EMAIL_FROM="Cooky <hello@yourdomain>"`.
✅ **Check:** `pnpm email:dev` previews every template in all 3 languages. Real emails land in the inbox, not spam.

## 8. Cloudflare R2
Create a **private** bucket (no public access, no r2.dev URL) and an API token scoped to it (Object Read & Write). Set all four variables; the CSP `img-src` picks up `https://<account id>.r2.cloudflarestorage.com` automatically. Until they're set, photo uploads say they aren't available and the rest of the app works.
✅ **Check:** upload a phone photo → the stored object is WebP with no EXIF/GPS. Its URL expires after 10 minutes, and a non-friend gets 403.

## 9. Pusher Channels
Create a Channels app and **disable client events**. Set `PUSHER_APP_ID`, `PUSHER_SECRET` (server) and `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` (client). The browser's private channel is signed by the `authorizeRealtime` Server Action (no auth endpoint to configure). Without the four variables, chat still works: an open conversation refreshes every few seconds and typing indicators are off.
✅ **Check:** two friends in two browsers → messages, typing and "Seen" appear instantly. In the Pusher debug console, events contain **only ids** (`{ type, conversationId }`).

## 10. Web Push
`npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@yourdomain`. **Never rotate** without a migration plan (it invalidates every subscription). Push needs a production build over HTTPS, and on iOS the app must be added to the Home Screen first. Without the keys, Settings → Notifications says push isn't available and in-app alerts still work.
✅ **Check:** enable push → close the app → a friend's message arrives as a localized notification. Revoke that device → no more pushes.

## 11. AI (Vercel AI SDK)
- Chat primary: Groq (`GROQ_API_KEY`, `AI_CHAT_MODEL`, e.g. a current `gpt-oss` model; Groq retires models, so check its model list). Fallback: OpenAI (`OPENAI_API_KEY`, `AI_FALLBACK_MODEL`, e.g. a current mini model).
- Transcription: `AI_TRANSCRIBE_MODEL` (default `whisper-large-v3-turbo` on Groq; OpenAI falls back to `whisper-1`). Both keys are optional: without them voice dictation says it's unavailable and refunds the try.
- Use **paid tiers** in production; free token-per-minute caps can't serve paying users.
✅ **Check:** a Free user asks 10 questions, and the 11th opens the upgrade sheet. Break the primary key → answers still arrive via the fallback, without using an extra try.

## 12. Open-Meteo
The free API is **non-commercial only**, so subscribe to the commercial plan and set `OPEN_METEO_API_KEY`. Weather is cached in Redis for 30 minutes by rounded coordinates.
✅ **Check:** the weather chip shows the right condition. The browser's network tab shows **no** request to open-meteo.com.

## 13. Sentry · 14. PostHog
- **Sentry:** a Next.js project with `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`. Upload source maps at build time, **don't serve them publicly**, and turn on PII scrubbing.
- **PostHog:** server-side capture only (`signup`, `onboarding_done`, `dish_created`, `cook_logged`, `try_limit_hit`, `checkout_started`, `subscription_activated`, `share_link_signup`). No client snippet, so no cookie banner needed.

---

## Before you go live
- [ ] CI green: lint, typecheck, unit, integration, build, E2E (incl. the Stripe test-mode upgrade/downgrade)
- [ ] `pnpm db:migrate` + `pnpm db:seed` ran on production; PITR on; a restore rehearsed once
- [ ] Production env complete (live Stripe keys + webhook secret, OAuth production credentials)
- [ ] Stripe live: products synced, portal configured, Tax on, webhook returns 200
- [ ] QStash schedules registered against the production URL (`pnpm jobs:schedule https://your-domain`)
- [ ] Pusher and VAPID keys set (optional at boot, required for launch: live chat and push)
- [ ] R2 set (optional at boot, required for launch: photos and data exports)
- [ ] Operator details filled in `config/legal.ts` (`OPERATOR`): the imprint and legal pages show them
- [ ] Legal texts (`messages/*.json` → `legal`) reviewed by a lawyer for your country; bump `LEGAL_VERSIONS` when they change
- [ ] At least one admin: `pnpm admin:set you@yourdomain`
- [ ] Security: securityheaders.com A+, no `unsafe-eval` in the CSP, no secrets in client chunks (CI greps the build output for key prefixes)
- [ ] Zero-leak review: every page's RSC payload contains only DTO fields
- [ ] Sending domain verified (SPF/DKIM/DMARC)
- [ ] Legal: terms, privacy policy (processors listed in `config/legal.ts` → `PROCESSORS`; add PostHog there if you turn it on), refund policy, imprint — published at `/terms`, `/privacy`, `/refunds`, `/imprint`
- [ ] Alerts: error spikes, webhook failures, outbox dead letters; uptime monitors on `/` and `/api/webhooks/stripe`
- [ ] At least two admins; secrets in a password manager; `BETTER_AUTH_SECRET` and VAPID keys backed up
