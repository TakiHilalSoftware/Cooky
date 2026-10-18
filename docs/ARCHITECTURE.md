# Technical Blueprint & Architecture: Cooky

## 0. Guiding Rules
1. **The server decides, the client displays.** Every read, rule, ranking, limit and permission check runs on the server. Client components render props and send intents to Server Actions.
2. **Nothing leaks.** The browser never receives secrets, raw database rows, other users' emails, internal flags, business rules or third-party URLs it could call directly. Data crosses the boundary only as explicit, minimal **DTOs**.
3. **One pipeline for every mutation:** auth → authorize → validate → plan/tries → rate limit → transaction → audit/outbox → revalidate.
4. **Durable over clever:** tries, rate limits, sessions and side effects live in Postgres/Redis, never in process memory or browser storage.
5. **Use proven libraries for solved problems** (auth, action middleware, env validation, UI primitives, AI calls). Hand-build only Cooky's own domain logic.

## 1. Tech Stack

Pin exact versions when the project is created, using the latest stable releases at that time. Before using a library's API, read its current docs, because several of these move fast. For Next.js, read `node_modules/next/dist/docs/` when present and heed deprecation notices.

| Area | Choice | Why / notes |
| --- | --- | --- |
| Framework | **Next.js** (App Router), **React 19**, **TypeScript strict** | Server Components, Server Actions, `after()`, typed routes. The request interceptor is `proxy.ts` (called `middleware.ts` in older majors); use whichever the installed version documents |
| Package manager | **pnpm** | Fast, strict dependency tree |
| Server Actions | **next-safe-action** + **Zod** | Typed action clients with middleware (auth, plan/tries, rate limit), schema validation, typed results, `useAction` / `useOptimisticAction` hooks |
| Env validation | **@t3-oss/env-nextjs** + Zod | Separate server/client schemas, fails the build/boot on missing vars, blocks server vars from client code |
| Auth | **Better Auth** (Drizzle adapter) | DB sessions, email/password, verification, reset, Google/Apple, 2FA (TOTP), passkeys, admin plugin (roles, ban = suspend), built-in rate limiting. A breached-password check is added (HIBP k-anonymity) |
| Database | **PostgreSQL** on **Neon** | Branch per preview deployment, point-in-time recovery |
| ORM & migrations | **Drizzle ORM** + **drizzle-kit** | Typed schema in TS, readable SQL migrations |
| Search | Postgres **full-text** + **pg_trgm** + **unaccent** | Typo-tolerant, multilingual, no extra service |
| UI | **Tailwind CSS v4** + **shadcn/ui** (Radix) + **lucide-react** | Accessible primitives owned in-repo; RTL-ready with logical properties |
| UI extras | **sonner** (toasts + undo), **vaul** (mobile bottom sheets), **@dnd-kit** (planner drag & drop), **motion** (weather chip, spin wheel; reduced-motion aware) | Small, well-maintained |
| i18n | **next-intl** | `en`, `fr`, `ar` (RTL), locale-prefixed routes, ICU plurals |
| Dates | **date-fns** + **@date-fns/tz** | Locale formatting, per-user timezones for reminders |
| Payments | **Stripe** (`stripe` SDK) | Hosted Checkout + Customer Portal + Tax. No Stripe JS on the client (redirect flow) |
| Rate limiting & cache | **Upstash Redis** + **@upstash/ratelimit** | Durable burst limits and weather cache on serverless |
| Background jobs | Transactional **outbox** table + **Upstash QStash** | Reliable side effects with retries, schedules and delayed messages (timer alerts) |
| Object storage | **Cloudflare R2** via `@aws-sdk/client-s3` + presigner | Private bucket, short-lived signed URLs, no egress fees |
| Images | **sharp** | Resize, WebP, strip EXIF/GPS on upload |
| Email | **Resend** + **React Email** | Templated, localized transactional mail |
| Realtime | **Pusher Channels** | Private channels authorized by the server, ids-only events |
| Web Push | **web-push** (VAPID) | Free, no vendor account |
| PWA | **Serwist** + **idb** | Service worker (static cache, offline page, push); IndexedDB for the offline shopping exception |
| AI | **Vercel AI SDK** (`ai`) with Groq + OpenAI providers | Structured output validated by Zod, provider fallback, transcription. Server-only, metered |
| Weather | **Open-Meteo** (commercial plan) | Forecast + geocoding, cached server-side |
| Prayer times | **adhan** | Iftar/suhoor times for Ramadan mode from city coordinates |
| Link import | **cheerio** + **ipaddr.js** | Parse schema.org `Recipe` JSON-LD; SSRF guard |
| Calendar feed | **ical-generator** | Pro iCal feed |
| Observability | **Sentry**, **pino**, **posthog-node** | Errors with PII scrubbing, structured logs, server-side product events only |
| Testing | **Vitest**, **Testing Library**, **MSW**, **Playwright** | Unit, component, provider mocks, E2E |
| Lint & format | **ESLint** (next + typescript-eslint strict + **eslint-plugin-boundaries**) + **Prettier** | Boundary rules enforce the server/client split |
| CI & hosting | **GitHub Actions**, **Vercel** (Node runtime) | Preview per PR with a Neon branch |

---

## 2. System Architecture Diagram

```ascii
+---------------------------------------------------------------------------+
|              Browser / Installed PWA (EN·FR·AR): "dumb" UI                |
|  Client components: render DTO props, call Server Actions, optimistic UI  |
|  Service worker: static cache, offline page, push display                 |
|  IndexedDB: ONLY the user's offline shopping list + today's recipe        |
+-------------+-----------------------------------------+-------------------+
              | HTTPS only to Cooky                     | WSS (private chans,
              | (RSC, Server Actions, signed img URLs)  |  ids-only events)
              v                                         v
+---------------------------------------------+   +-------------------+
|  Next.js on Vercel                          |   |  Pusher Channels  |
|  proxy: locale, CSP nonce, session gate     |   +---------^---------+
|  app/  -> pages (RSC), thin                 |             | trigger
|  server/ (import "server-only")             |-------------+
|   ├─ actions/ (next-safe-action clients)    |
|   ├─ features/<x>/ service·queries·policy·dto---> Stripe API  <-- webhooks
|   ├─ auth (Better Auth) billing quota       |---> R2 (private, signed URLs)
|   ├─ ai weather storage realtime notify     |---> Groq / OpenAI (AI SDK)
|   └─ outbox jobs audit                      |---> Open-Meteo (cached)
|  api/: auth, webhooks, pusher auth, jobs,   |---> Resend (email)
|        cron, ical, share-target, downloads  |---> Web Push services
+-------+-------------------------+-----------+
        | Drizzle (pooled)        | REST              ^
        v                         v                   |
+-------------------+     +----------------+   +------+--------+
| PostgreSQL (Neon) |     | Upstash Redis  |   | QStash        |
| data, sessions,   |     | burst limits,  |   | drains outbox,|
| tries, outbox,    |     | weather cache  |   | schedules,    |
| billing, audit    |     +----------------+   | delays        |
+-------------------+                          +---------------+
```

The CSP `connect-src` allows only `'self'` and Pusher. `img-src` allows `'self'`, `blob:` (local crop previews) and the R2 signed-URL host.

**CSP and rendering (decided in Phase 0):**
- Scripts run under a per-request nonce with `'strict-dynamic'`, built in `src/server/security/headers.ts` and applied by `src/proxy.ts`.
- Next.js applies nonces only to dynamically rendered pages and documents Partial Prerendering as incompatible with them. So `cacheComponents`/`partialPrefetching` stay **off**, and every page renders per request.
- `style-src` allows `'unsafe-inline'` because Radix positions popovers with style attributes and sonner injects its stylesheet at runtime. Style injection can't run code.
- PRD §3.0 asks for a statically rendered landing page. Revisit this in Phase 3: either Next's (experimental) SRI hash-based CSP for the `(marketing)` group, or accept dynamic rendering if TTFB stays within budget.

**Pinned at project creation (Phase 0):** Next.js 16.4.2, React 19.3, TypeScript 5.9, Tailwind 4.3, shadcn 4.22 (Radix base, `radix-nova` style, RTL on), next-intl 4.14, next-safe-action 8.7, Zod 4.6, Drizzle ORM 0.45 / drizzle-kit 0.31, @t3-oss/env-nextjs 0.13, @sentry/nextjs 11.8, pino 10, Vitest 5, Playwright 1.64.
- TypeScript stays on 5.9 (what `create-next-app` installs) rather than the native TS 7.
- jsdom is held at 29 because jsdom 30 needs Node ≥ 22.22.2.

**JS budget measurement (Phase 0, `/en`, gzip):** about 265 KB in total.
- React + Next runtime alone is ≈ 165 KB, above PRD §3.10's 150 KB per route before any Cooky code.
- Radix tooltip/dropdown + lucide + the ICU formatter add ≈ 66 KB, and sonner ≈ 11 KB.
- The Sentry browser SDK (≈ 100 KB) loads only when a DSN is set (`src/lib/report-error.ts`).
- **Open decision:** whether the budget counts route JS on top of the shared framework, or the whole first load. Candidate savings are next-intl's precompiled messages, a lazy Toaster, and lazy menus.

---

## 3. Server/Client Boundary

| Lives on the **server** (never shipped) | Allowed on the **client** |
| --- | --- |
| DB access, Drizzle schema, queries | Rendering DTO props |
| Cook ranking, spin picking, ingredient matching, search | Form state, drafts, open/closed UI state |
| Plan limits, tries, prices, entitlements | Showing "7 of 10 tries left" (a server value) |
| AI prompts, provider calls, candidate shortlists | Recording audio and sending it to an action |
| Weather fetch, mood and condition mapping | Asking for browser location once (coords → action) |
| Stripe calls and webhooks | Redirecting to the Checkout/Portal URL an action returns |
| Image processing, signed URL creation | Local crop preview (`blob:`) before upload |
| Push/email sending, Pusher triggers | Subscribing to its own private channel; on an event → refresh |
| Link import fetching and parsing (SSRF guard) | Sending the pasted/shared URL to an action |
| Shopping list (source of truth) | **Offline exception:** an IndexedDB copy of the user's own active list + today's recipe, plus a queue of pending check-offs, wiped on logout |
| Env secrets | Public env allow-list only: Pusher key/cluster, VAPID public key, Sentry DSN, app URL |
| — | Pure UI conveniences in `localStorage`: theme, text size, collapsed panels, unsent drafts, running timers |

**Enforcement:**
- Every file in `src/server/` imports `server-only`, except the action entry files (`"use server"`) and `dto.ts` type files.
- `eslint-plugin-boundaries`: `src/components/**` may import only `src/server/actions/**`, `src/server/**/dto.ts` (types) and `src/lib/**`.
- DTO mappers are the only way data leaves `server/`. User and session objects are tainted (`experimental_taintObjectReference` / `experimental_taintUniqueValue`), so an accidental hand-off to the client fails loudly.
- `@t3-oss/env-nextjs`: the client schema is the complete list of public variables. `src/server/env.test.ts` fails if it drifts from SETUP_KEYS.
- Two documented exceptions read `process.env` directly:
  - `instrumentation-client.ts`: it runs before React and can't import a server-only module, and it reads only `NEXT_PUBLIC_SENTRY_DSN`.
  - `src/server/security/headers.ts`: it skips `server-only` because `next.config.ts` loads it at build time. It holds policy strings, no secrets.
- `tests/lint/boundaries.test.ts` runs ESLint on deliberate violations, so a weakened boundary rule fails CI.
- Better Auth is called with `authRequestHeaders()`: the request headers with the Cookie header rebuilt from the live `cookies()` store, so a session replaced inside an action (2FA, password change) is seen immediately.
- Expected action failures use next-safe-action's built-in `returnServerError(code)`. Anything thrown is logged and becomes `unavailable` in `handleServerError` (`src/server/actions/_clients.ts`).
- Data only reaches the client through Server Component props or Server Action return values. **No client `fetch` for data.**

---

## 4. Database Schema (ERD)

Drizzle schema in `src/server/db/schema/`. Ownership and sharing rules live in `features/*/policy.ts`, and every query goes through them. *(Optional hardening: Postgres RLS with `SET LOCAL app.user_id` per transaction.)* Every table has `created_at`/`updated_at`. User-owned rows cascade on account purge. Ids are UUID v7.

### 4.1 Identity & Security
- **Better Auth tables:** `user`, `session`, `account` (password + Google/Apple), `verification`, plus the two-factor and passkey plugin tables, and the admin plugin's role/ban fields. **Generate them with the Better Auth CLI into the Drizzle schema. Don't hand-write them.** App additions on `user` (`additionalFields`): `status` (active|pending_deletion), `deletion_requested_at`. Suspension uses the admin plugin's ban.
- **`consents`**: `user_id`, `document` (terms|privacy), `version`, `accepted_at`
- **`profiles`**: `user_id` PK, `display_name`, `avatar_key` (R2), `city`, `lat`, `lon`, `hemisphere`, `timezone`, `locale`, `accent`, `theme`, `text_size`, `units` (metric|imperial), `dietary_prefs[]`, `ramadan_mode`, `share_activity`, `intro_seen[]`, notification prefs, `quiet_hours`
- **`push_subscriptions`**: `user_id`, `session_id` (FK → session, **cascade**: revoking a device removes its push), `endpoint` (unique), `p256dh`, `auth`, `locale`

### 4.2 Billing & Tries
- **`billing_customers`**: `user_id` PK, `stripe_customer_id` (unique)
- **`subscriptions`**: `id` (Stripe sub id), `user_id`, `plan` (plus|pro), `interval` (month|year), `status` (trialing|active|past_due|canceled|incomplete), `current_period_start/end`, `cancel_at_period_end`, `trial_end`
- **`entitlements`**: `user_id` PK, `plan` (free|plus|pro), `source` (stripe|comp|trial), `period_start`, `period_end`. Recomputed by webhook, reconcile job and admin comps.
- **`trial_redemptions`**: `user_id` PK, `plan`, `redeemed_at` (one trial per account)
- **`plan_limits`** (seeded): `plan`, `feature`, `limit` (null = unlimited), `period` (day|month|none)
- **`usage_counters`**: (`user_id`, `feature`, `period_start`) PK, `used`, `reserved`
- **`usage_events`**: `user_id`, `feature`, `status` (reserved|committed|refunded), `ref`, `at` (ledger)
- **`stripe_events`**: `id` PK (Stripe event id), `type`, `processed_at` (idempotency)

### 4.3 Recipes
- **`dishes`**: `user_id`, `name`, `difficulty`, `course`, `seasons[]`, `servings`, `dietary_tags[]`, `visibility` (private|friends|groups), `image_key`, `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`, `catalog_dish_id` (FK set null), `copied_from_dish_id` (FK set null), `search` (tsvector)
- **`dish_ingredients`**: `dish_id`, `position`, `name`, `amount` (numeric), `unit` (enum), `note`, `ingredient_id` (FK set null), `catalog_ingredient_id` (FK set null)
- **`dish_steps`**: `dish_id`, `position`, `text`, `timer_seconds`, `prep_day_before` (bool)
- **`ingredients`** (dictionary): names per locale + variants, `aisle`, `default_unit`, `is_common_staple`
- **`dish_ratings`**: `dish_id`, `user_id`, `rating` (1–5), `review`, unique (dish, user)
- **`dish_notes`**: (`dish_id`, `user_id`) PK, `text`
- **`favorites`**: (`user_id`, `dish_id`) PK · **`collections`**: `user_id`, `name`, `position` · **`collection_dishes`**: (`collection_id`, `dish_id`)
- **`dish_share_links`**: `dish_id`, `token_hash`, `revoked_at`, `views`
- **`dish_sources`**: `dish_id`, `url`, `site_name`, `imported_at`
- **`dish_groups`**: (`dish_id`, `group_id`)
- **`pantry_items`**: `user_id`, `ingredient_id` or `name`, `is_staple`
- **`catalog_dishes`** / **`catalog_ingredients`** / **`catalog_steps`**: the Discover catalog, with `country`, `course`, `dietary_tags[]`, `image_key`, `collections[]` and translations per locale (EN required; FR/AR fall back to EN)

### 4.4 Deciding & Planning
- **`cook_log`**: `user_id`, `dish_id`, `date`, `meal_slot`, `source` (cook|spin|planner|assistant)
- **`spin_sessions`**: (`user_id`, `date`) PK, `picked_dish_ids[]`, `mode`, `filters`
- **`assistant_threads`** / **`assistant_messages`**: `thread_id`, `role`, `content`, `picks` (jsonb DTO), `tokens_in/out` (90-day retention)
- **`events`**: `user_id`, `name` (1–100), `date`, `guests` (1–500) · **`event_dishes`**: `event_id`, `dish_id`, `course`, unique (event, course)
- **`shopping_lists`**: `owner_id`, `name`, `version` · **`shopping_list_members`** (Pro) · **`shopping_items`**: `list_id`, `ingredient_id`/`name`, `amount`, `unit`, `aisle`, `checked`, `checked_at`, `source_dish_ids[]`, `manual`
- **`calendar_feeds`**: `user_id`, `token_hash`, `revoked_at`

### 4.5 Social
- **`friend_requests`**: `from_user_id`, `to_user_id`, `status` (pending|accepted|declined); one pending per direction
- **`friendships`**: `user_a_id` < `user_b_id` (canonical pair, unique)
- **`user_blocks`**: (`blocker_id`, `blocked_id`) PK. A block in either direction keeps two users apart.
- **`friend_groups`**: `owner_id`, `name` (1–40, unique per owner, case-insensitive) · **`friend_group_members`**: (`group_id`, `member_id`)
- **`conversations`**: `user_a_id` < `user_b_id`, `archived_by_a/b`, `deleted_by_a/b`. Kept after an unfriend, read-only.
- **`messages`**: `conversation_id`, `sender_id`, `content` (≤4000), `dish_id` (set null), `edited_at`, `deleted_at` (soft), `delivered_at`
- **`conversation_reads`**: (`conversation_id`, `user_id`) → `last_read_at`
- **`activity_events`**: `user_id`, `kind` (cooked|rated|shared), `dish_id`, `at`. Written only if `share_activity` is on, and read through the sharing policy.
- **`reports`**: `reporter_id`, `target_type` (user|dish|message|review), `target_id`, `reason`, `status`, `resolution`

### 4.6 Operations
- **`outbox`**: `kind` (email|push|pusher|export|import|stripe_sync|purge|reminder), `payload` (jsonb), `status`, `attempts`, `run_after`, `last_error`
- **`audit_log`**: `actor_id`, `action`, `target_type`, `target_id`, `meta`, `ip_hash`, `at`
- **`feedback`**: `user_id`, `kind` (bug|feature|other), `message` (≤4000), `locale`, `user_agent`, `status` (open|resolved), `resolved_at`
- **`reminders`**: `user_id`, `kind` (plan_tomorrow|event_shopping|rate_cook|prep), `local_time`, `enabled`, `next_run_at`
- **`timer_alerts`**: `user_id`, `session_id`, `label`, `fires_at`, `qstash_message_id`, `cancelled_at`
- **`data_exports`**: `user_id`, `status`, `object_key`, `expires_at`

---

## 5. Pipelines

1. **Server Action Pipeline** (next-safe-action, `src/server/actions/_clients.ts`):
   - **Clients:** `publicAction` (IP rate limit) → `userAction` (Better Auth session from the DB, rejects banned and pending-deletion users) → `adminAction` (role check) → `meteredAction(feature)` (reserves a try first).
   - **Each action:** Zod `inputSchema` → policy check → Upstash burst limit → handler in `db.transaction`, writing `audit_log`/`outbox` rows in the same transaction → commit the try (or refund on error) → `revalidateTag`/`revalidatePath`.
   - **Results:** typed `{ data }` or a typed error code (`unauthorized | forbidden | not_found | invalid | rate_limited | quota_exceeded | plan_required | conflict | unavailable`), translated on the client. Stack traces go to Sentry only.
2. **Tries Pipeline:**
   - `reserve(user, feature)` is an atomic `UPDATE usage_counters SET reserved = reserved + 1 WHERE used + reserved < limit RETURNING …`, with an upsert for a new period and a ledger row.
   - After the work: **commit** (`used+1, reserved−1`) on success, **refund** (`reserved−1`) on provider failure.
   - Reservations older than 5 min are released by a scheduled job.
   - The limit is `plan_limits[entitlement.plan][feature]`. The period is the UTC calendar month for Free and the billing period for paid plans.
3. **Subscription Pipeline:**
   - `startCheckout(plan, interval)` gets or creates the Stripe Customer, creates a Checkout Session (with a trial only if there's no `trial_redemptions` row) and returns the redirect URL.
   - Stripe → `/api/webhooks/stripe`: verify the signature → dedupe on `stripe_events` → upsert `subscriptions` → recompute `entitlements` → queue email/push in the outbox.
   - The success page reads entitlements from the DB, never from the query string. `openBillingPortal()` works the same way.
   - A nightly reconcile re-syncs active subscriptions.
   - **Downgrade** marks over-limit content read-only by checks (`dishes count > limit` → block create); nothing is deleted.
4. **Auth Pipeline (Better Auth):**
   - Email/password and Google/Apple. Email verification is required. 2FA and passkeys come from plugins.
   - Better Auth handles its own rate limiting (production only), plus Upstash burst limits in our actions (production only) and the HIBP check before setting a password.
   - **Progressive lockout** (`src/server/auth/lockout*.ts`): failed password logins per email (stored as a keyed hash, also for unknown emails) lock for 1 min / 5 min / 30 min / 2 h at 5 / 10 / 15 / 20 failures; forgotten after a quiet day, a correct password or a password reset. It runs in Better Auth's before/after hooks on `/sign-in/email`, so it guards both our action and the raw endpoint. 2FA codes use the plugin's own lockout (5 tries → 15 min).
   - 2FA (TOTP + 10 backup codes) and passkeys come from Better Auth plugins. Passkey ceremonies run through Server Actions (options → `@simplewebauthn/browser` → verify); the browser never calls `/api/auth` directly.
   - The proxy does only a fast cookie-presence gate. The data layer validates the session against the DB on every request (cached per request).
   - Signing out or a password change revokes sessions. A cascade removes those devices' push subscriptions, and the client wipes offline data.
   - Auth emails are sent through the outbox → Resend.
5. **Weather & Top-bar Chip Pipeline:**
   - The `(app)` layout calls `getWeatherChip(user)` with the profile's `lat/lon` (geocoded from the city once, server-side).
   - It checks Redis under `wx:{lat.1}:{lon.1}` (coordinates rounded to 0.1°, 30-min TTL). On a miss, it fetches Open-Meteo `current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day` (3 s timeout).
   - **WMO code → condition:** 0–1 → `sunny`/`clear_night` (by `is_day`) · 2–3 → `cloudy` · 45, 48 → `foggy` · 51–67, 80–82 → `rainy` · 71–77, 85–86 → `snowy` · 95–99 → `stormy`. Wind ≥ 40 km/h turns sunny/cloudy into `windy`. Accent: ≥ 30 °C → `hot`, ≤ 0 °C → `freezing`.
   - The same result gives the ranking mood (`cozy`/`light`/`neutral`) for Cook, Spin and the Assistant.
   - DTO: `{ condition, accent, tempC, feelsLikeC, windKmh, precipMm, isDay, iftarAt? }`, with no coordinates and no provider URL.
   - On failure, the chip hides and the mood is neutral.
6. **Ingredient Matching Service:**
   - `normalize()` folds case and accents, unifies Arabic letter forms (أ/إ/آ→ا, ة→ه, ى→ي), and strips the article "ال" from words longer than 3 letters.
   - `matches(line, wanted)`: every wanted word prefix-matches some word of the line, and words under 3 letters must match exactly.
   - `filter(dishes, wanted[])` → `{ mode: "all" | "any" | "none", dishes }`.
   - Autocomplete ranks dictionary entries (staples with regional variants, catalog, user names) for the current locale using `pg_trgm`.
   - The shopping merge keys on `ingredient_id` when linked, otherwise on the normalized name. Amounts are summed when units convert (g↔kg, ml↔l, tsp↔tbsp…).
7. **Cook / Spin Pipeline:**
   - `rankDishes(extraHave?)`: load the user's dishes + pantry + weather mood + hemisphere season + dietary prefs + recent `cook_log`. Sort by missing count, then weather fit, dietary fit and recency. Return ordered DTOs (name, image URL, missing names, badges).
   - `spin(mode, filters)`: try/limit check → weighted random pick from the server-side pool, excluding today's `spin_sessions.picked_dish_ids` → one DTO.
8. **Assistant Pipeline:**
   - `askAssistant(threadId?, text)` → reserve a try → load the context (dishes, catalog, last 14 days of cooking, events in the next 21 days, weather, pantry, dietary prefs).
   - **Shortlist** ≤40 own + ≤16 Discover candidates ranked against the conversation, shown to the model as short aliases (`m3`, `d12`).
   - AI SDK structured output with a Zod schema `{ reply, picks: [{ id, why }] }`. Groq primary → OpenAI fallback on 429/5xx, with a 25 s timeout.
   - Unknown ids are dropped, the messages persisted, the try committed, and a DTO returned.
   - User and dish text are treated as data, never instructions. The model has no tools with side effects.
9. **Voice Pipeline:** The client records with MediaRecorder → `transcribe(formData)` action (≤4 MB, MIME sniffed) → reserve a try → AI SDK transcription with a per-locale style prompt → commit/refund → for dictation, the server parses the text into structured ingredient rows.
10. **Upload Pipeline:** The client crops locally → `uploadImage(file, purpose)` action → size and magic-byte check → `sharp` (resize 1280 px dish / 512 px avatar, WebP, strip metadata) → R2 `u/{userId}/{uuid}.webp` → store the key. Reads: a 10-min signed GET URL is put in the DTO only if the policy allows the viewer.
11. **Realtime & Notifications:**
    - `sendMessage` → friendship/block/policy check → insert → outbox. Pusher gets `{ type: "message", conversationId }` on the recipient's private channel. Push is localized and respects preferences.
    - The recipient's client refreshes the thread through the server.
    - Typing events are server-triggered and rate-limited. Delivered and seen receipts are updated through actions.
12. **Outbox & Jobs:**
    - QStash calls `/api/jobs/drain` (signature-verified) every minute, with exponential backoff (max 8 attempts → dead letter + alert).
    - Schedules: expired auth data cleanup, stale reservation release, account purge after the grace period (cancel Stripe, delete R2 objects, delete rows), orphan R2 cleanup, assistant history pruning, Stripe reconcile, data export expiry.
13. **Email Pipeline:** React Email template (per locale) → outbox → Resend. Links are built from the validated `APP_URL`, never from the request. Tokens are single-use, hashed and short-lived.
14. **Recipe Import Pipeline:**
    - `importFromUrl(url)` → reserve a try.
    - **SSRF guard:** https only, resolve DNS and reject private/loopback/link-local ranges (`ipaddr.js`), re-check each redirect, 5 s timeout, 2 MB cap, `text/html` only.
    - `cheerio` parses JSON-LD `Recipe`. If none is found, AI extraction runs (same try).
    - The result becomes a **draft DTO** (ingredients mapped through the matching service) shown in the dish form. Nothing is saved until the user confirms, and the image is copied into R2 on save.
    - The PWA `share_target` posts to `/api/share-target`, which redirects to the import form.
15. **Offline Shopping Sync:**
    - With the setting on, the shopping and cooking-mode pages pass the client a versioned snapshot DTO of the user's own active list and today's recipe. The client stores it in IndexedDB under the user id.
    - Offline check-offs are queued as `{ itemId, checked, at }`. On reconnect they replay through `toggleShoppingItem` (idempotent, last-write-wins by `at`), then the client reloads the server version.
    - Logout, session revoke or a user switch wipes the store. The login response carries a `clear-offline` instruction.
16. **Reminders & Timer Alerts:**
    - An hourly schedule selects `reminders` due in each user's timezone, skipping quiet hours and users with nothing relevant (e.g. no event tomorrow), then the outbox delivers localized push/email.
    - Starting a named timer schedules a QStash delayed message for `fires_at`. Cancelling it cancels the message, and on firing the job sends the push.
17. **Catalog Pipeline:** A seed script (TheMealDB-style source data copied into our DB, never called at runtime) plus translation files, then admin CRUD. Saved copies keep FK links, so reads show the current locale's translation until the user edits the copy.
