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
| Client cache | **TanStack Query** (`@tanstack/react-query`) | For screens with rapid writes or live lookups (My kitchen + Ready to cook, global search, ingredient autocomplete): optimistic mutations with rollback, the action's returned DTO written straight into the cache (no route re-render), per-key caching of lookups. Queries and mutations call **Server Actions only**, never `fetch`; see §3 |
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
| Link import | Node `http`/`https` + `node:dns` (no extra deps) | Pinned-DNS SSRF guard; schema.org `Recipe` JSON-LD parser |
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
|  api/: auth, webhooks, jobs, cron,         |---> Resend (email)
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
- **TanStack Query** is a cache over those two sources, not a third one (`src/components/query/`):
  - `queryFn`/`mutationFn` call a Server Action and pass its result through `unwrap()`, which returns `data` or throws an `ActionError` carrying only the typed code. `errorCode(error)` turns any failure into a code for `useFormMessages().action()`; raw messages never render.
  - A query starts from the page's own render (`initialData` from Server Component props), so nothing is fetched twice. The cache outlives navigation, so `useServerSeed` writes each new render into it before paint (unless writes are in flight, or the render is one it already took in): returning to a page never shows an older cached copy. Defaults: 30 s `staleTime`; reads retry twice on outages but never on a final code (`unauthorized`, `not_found`, `rate_limited`…); writes never retry.
  - Mutations that change data shown elsewhere return the updated DTO, and `onSuccess` writes it into the cache; the action still revalidates, so other pages kept by the page cache (below) are dropped. With several writes in flight (Server Actions run one at a time), only the last to settle writes its answer, so an earlier answer never undoes a later tap; follow-up queries are invalidated once, when the last write settles.
  - The `QueryProvider` is mounted by `PublicShell` for signed-in pages only, keyed by the account's `deviceKey`: signing out or switching accounts starts with an empty cache, so keys never carry a user id. Keys live in `components/query/keys.ts`.
  - Use it where it earns its ~13 KB: rapid optimistic writes and typed lookups. Plain forms and one-shot actions keep `useAction` / `useOptimistic`.
- **Page cache (no skeleton on return).** `staleTimes.dynamic` (`src/lib/page-cache.ts`, 30 min) keeps pages already shown in this tab, so switching back is instant. It stays correct because:
  - every action that changes what a page shows calls `revalidatePath`/`revalidateTag`, which empties the whole cache;
  - a kept page older than a minute, reached by a link or by Back/Forward, shows at once and is refreshed in the background by `FreshnessRegion` (the shell's `<main>`, `components/app-shell/route-freshness.tsx`): meanwhile it is dimmed, `aria-busy`, with a "Refreshing…" pill, and stays usable (the server still decides every write). A page seen within the last minute isn't refreshed, so quick back-and-forth costs nothing. A `router.refresh()` empties every kept page (checked in Next 16.4, though its docs say only the current route), so a page that arrives under its route skeleton is known to be fetched anew and isn't refreshed twice;
  - a first visit, a full reload and the next day still show the route's `loading.tsx` skeleton: the cache is memory only, and user data is never kept in browser storage (AGENT_RULES §2).
- **Filters in the URL** (links and GET forms) wrap the page in `PendingScope` and the results in `PendingResults` (`components/feedback/pending-results.tsx`): while new results load, the old ones stay, dimmed, `aria-busy`, with "Updating results…".

---

## 4. Database Schema (ERD)

Drizzle schema in `src/server/db/schema/`. Ownership and sharing rules live in `features/*/policy.ts`, and every query goes through them. *(Optional hardening: Postgres RLS with `SET LOCAL app.user_id` per transaction.)* Every table has `created_at`/`updated_at`. User-owned rows cascade on account purge. Ids are UUID v7.

### 4.1 Identity & Security
- **Better Auth tables:** `user`, `session`, `account` (password + Google/Apple), `verification`, plus the two-factor and passkey plugin tables, and the admin plugin's role/ban fields. **Generate them with the Better Auth CLI into the Drizzle schema. Don't hand-write them.** App additions on `user` (`additionalFields`): `status` (active|pending_deletion), `deletion_requested_at`. Suspension uses the admin plugin's ban.
- **`consents`**: `user_id`, `document` (terms|privacy), `version`, `accepted_at`
- **`profiles`** (Phase 1 uses display name, locale, accent, theme, text size; the rest arrive with their phases. The signed-in person's accent and text size are rendered on `<html>` by the locale layout so pages arrive styled; the theme follows the profile across devices, while signed-out visitors keep the browser's own choice): `user_id` PK, `display_name`, `avatar_key` (R2), `city`, `lat`, `lon`, `hemisphere`, `timezone`, `locale`, `accent`, `theme`, `text_size`, `units` (metric|imperial), `dietary_prefs[]`, `ramadan_mode`, `share_activity`, `intro_seen[]`, notification prefs, `quiet_hours`
- **`push_subscriptions`**: `user_id`, `session_id` (FK → session, **cascade**: revoking a device removes its push), `endpoint` (unique), `p256dh`, `auth`, `locale`

### 4.2 Billing & Tries
- **`billing_customers`**: `user_id` PK, `stripe_customer_id` (unique)
- **`subscriptions`**: `id` (Stripe sub id), `user_id`, `plan` (plus|pro), `interval` (month|year), `status` (trialing|active|past_due|canceled|incomplete), `current_period_start/end`, `cancel_at_period_end`, `trial_end`
- **`entitlements`**: `user_id` PK, `plan` (free|plus|pro), `source` (stripe|comp|trial), `period_start`, `period_end`. Recomputed by webhook, reconcile job and admin comps.
- **`trial_redemptions`**: `user_id` PK, `plan`, `redeemed_at` (one trial per account)
- **`trial_email_redemptions`**: `email_key` PK (HMAC of the normalised inbox: lowercase, `+tag` dropped, Gmail dots ignored; never the address), `redeemed_at`. No user FK on purpose: it survives account purge so the same inbox never gets a second trial (`server/billing/trial.ts`)
- **`plan_limits`** (seeded): `plan`, `feature`, `limit` (null = unlimited), `period` (day|month|none)
- **`usage_counters`**: (`user_id`, `feature`, `period_start`) PK, `used`, `reserved`
- **`usage_events`**: `user_id`, `feature`, `status` (reserved|committed|refunded), `ref`, `at` (ledger)
- **`stripe_events`**: `id` PK (Stripe event id), `type`, `processed_at` (idempotency)

### 4.3 Recipes
- **`dishes`**: `user_id`, `name`, `difficulty`, `course`, `seasons[]`, `servings`, `dietary_tags[]`, `visibility` (private|friends|groups), `image_key`, `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`, `catalog_dish_id` (FK set null), `copied_from_dish_id` (FK set null), `search` (tsvector), `deleted_at` (set on delete so Undo can restore it; `/api/cron/purge-deleted` removes it for good after 24 h). The dish cap (`plan_limits.dishes`) is checked under a per-user advisory lock; over the cap after a downgrade the box is read-only (view, cook, delete; no add or edit)
- **`dish_ingredients`**: `dish_id`, `position`, `name`, `amount` (numeric), `unit` (enum), `note`, `ingredient_id` (FK set null), `catalog_ingredient_id` (FK set null)
- **`dish_steps`**: `dish_id`, `position`, `text`, `timer_seconds`, `prep_day_before` (bool)
- **`ingredients`** (dictionary): `slug`, `name_en`/`name_fr`/`name_ar` + `variants[]` (plurals, regional Arabic), `aisle`, `default_unit`, `is_common_staple`, `search` (every name normalized by the matching service, trigram-indexed). Seeded by `pnpm db:seed:ingredients`. `dish_ingredients.ingredient_id` is linked on save when a line's normalized name is one of an entry's names or variants
- **`dish_ratings`**: `dish_id`, `user_id`, `stars` (1–5), `review`, unique (user, dish). `rateDish` refuses (`forbidden`) until the person has a `cook_log` entry for the dish
- **`dish_notes`**: (`dish_id`, `user_id`) PK, `text`
- **`favorites`**: (`user_id`, `dish_id`) PK · **`collections`**: `user_id`, `name` (unique per person, case-insensitive, among live ones), `position`, `deleted_at` (Undo) · **`collection_dishes`**: (`collection_id`, `dish_id`). The count is capped by `plan_limits.collections` under a per-user advisory lock
- **`backup_imports`**: `user_id`, `status` (queued|running|done|failed), `dishes` (the file's dishes, cleared once imported), `total`, `imported`, `skipped` ({duplicate, full, invalid}). Recipe backups are a versioned JSON file (`format: "cooky-backup"`, `version: 1`, ≤ 500 dishes, ≤ 5 MB; Server Actions accept 6 MB bodies for it). Export is on every plan; import (`plan_limits.backup_import`) is queued and run by the outbox job `backup_import`: dishes are checked one by one, same-name dishes and anything past the dish cap are skipped and counted
- **`dish_share_links`**: `dish_id`, `token_hash`, `revoked_at`, `views`
- **`dish_sources`**: `dish_id`, `url`, `site_name`, `imported_at`
- **`dish_groups`**: (`dish_id`, `group_id`)
- **`pantry_items`**: `user_id`, `ingredient_id` (nullable), `name` (as typed), `key` (`i:{ingredient_id}` or `n:{normalized name}`, unique per user, so "Tomatoes" and "tomate" are one item), `is_staple`. At most 300 per user (advisory lock); adding as a staple never demotes
- **`catalog_dishes`** / **`catalog_ingredients`** / **`catalog_steps`**: the Discover catalog, with `country` (ISO 3166-1 alpha-2, named with `Intl.DisplayNames` on the server only, since browsers and Node name some regions differently), `course`, `dietary_tags[]`, `collections[]` (ramadan_iftar, eid_sweets, summer_salads, winter_comfort, quick), `featured`, `photo_url`, `source` (`curated` from `pnpm db:seed:catalog`, `mealdb` from `pnpm db:seed:mealdb`; curated always wins) and translations per locale in `_en`/`_fr`/`_ar` columns (EN required; FR/AR fall back to EN). Catalog ingredients link to the dictionary. Seeded by `pnpm db:seed:catalog` (24 dishes, 14 countries). "Save to my dishes" creates a `dishes` row with `catalog_dish_id` and `follows_catalog = true`: until the person edits it, it shows the catalog's text in the viewer's language; the copy also stores its own text so it survives the entry being retired. "Ingredients you have" matches by dictionary entry when the wanted word is one (so طحين never stands in for طحينة), and by the text rules otherwise
- **`profiles`** (added in Phase 3): `city`, `latitude`/`longitude` (rounded to 2 decimals, about 1 km), `dietary_prefs[]`, `onboarded_at` (the starter pack is done or skipped)

### 4.4 Deciding & Planning
- **`cook_log`**: `user_id`, `dish_id`, `date` (the person's local day, from the `cooky.tz` cookie), `meal_slot`, `source` (cook|spin|planner|assistant). Logging can remove non-staple kitchen items that ran out; Undo deletes the entry
- **`spin_sessions`**: (`user_id`, `date`) PK, `picked_dish_ids[]`, `mode` (random|ingredients)
- **`assistant_threads`** / **`assistant_messages`**: `thread_id`, `role`, `content`, `picks` (jsonb DTO), `tokens_in/out` (90-day retention)
- **`events`**: `user_id`, `name` (1–100), `date`, `guests` (1–500) · **`event_dishes`**: `event_id`, `dish_id`, `course`, unique (event, course)
- **`shopping_lists`**: `owner_id`, `name`, `version` · **`shopping_list_members`** (Pro) · **`shopping_items`**: `list_id`, `ingredient_id`/`name`, `amount`, `unit`, `aisle`, `checked`, `checked_at`, `source_dish_ids[]`, `manual`
- **`calendar_feeds`**: `user_id`, `token_hash`, `revoked_at`

### 4.5 Social
Every social read and write goes through `features/social/policy.ts` (`areFriends`, `isBlockedEitherWay`, `dishVisibleToSql`, `findViewableDish`).
- **`friend_requests`**: `from_user_id`, `to_user_id`, `status` (pending|declined), `sent_at`, `cancelled_at`; one row per direction (unique pair). Accepting creates the friendship and deletes the requests. A decline stays, so the sender still sees "Requested" and asking again changes nothing for 30 days (`DECLINE_COOLDOWN_MS`, from `sent_at`); withdrawing a declined request sets `cancelled_at` (hidden from the sender, cooldown kept). 20 requests per hour, counted in the table (`REQUESTS_PER_HOUR`); crossing requests accept each other. Pair changes run under `lockPair` (advisory lock)
- **`friendships`**: `user_a_id` < `user_b_id` (canonical pair, PK, CHECK)
- **`user_blocks`**: (`blocker_id`, `blocked_id`) PK. A block in either direction keeps two users apart: search, requests (`not_found`, same as an unknown id), profiles, shared dishes and writing to a chat. Blocking ends the friendship, requests and group memberships; nobody is told
- **`friend_groups`**: `owner_id`, `name` (1–40, unique per owner, case-insensitive), capped by `plan_limits.friend_groups` under an advisory lock · **`friend_group_members`**: (`group_id`, `member_id`), current friends only (checked on save; unfriending removes them)
- **`dishes.visibility`** (private|friends|groups) + **`dish_groups`** (`dish_id`, `group_id`); **`dishes.copied_from_dish_id`**: "Copy to my dishes" makes a private copy (within the dish cap, photo copied under the copier's R2 prefix); rating the copy also rates the original while it's still visible
- **`conversations`**: `user_a_id` < `user_b_id` (unique, CHECK), `archived_by_a/b`, `cleared_at_a/b` ("delete chat" hides what came before for that side only), `last_message_at`. Kept after an unfriend, read-only (`canWrite` = friends and no block)
- **`messages`**: `conversation_id`, `sender_id`, `content` (≤4000), `dish_id` (set null; only a dish the recipient can open, re-checked when read), `edited_at`, `deleted_at` (soft; Undo for 2 minutes; the daily purge blanks the text after a day), `delivered_at`
- **`conversation_reads`**: (`conversation_id`, `user_id`) → `last_read_at` (drives "seen" and the unread dot)
- **`reports`**: `reporter_id` (set null), `target_type` (user|dish|message|review), `target_id`, `reason` (spam|harassment|inappropriate|impersonation|other), `details`, `status` (open|resolved|dismissed), `resolution`, `resolved_by`, `resolved_at`; one open report per reporter and target. Only what the reporter can see can be reported
- **`push_subscriptions`**: see §4.1 · **`profiles.notifications_off[]`** (messages|friend_requests|friend_accepted|timers|billing), **`profiles.friends_seen_at`** (new-request badge), **`profiles.checklist_dismissed_at`** (first-week checklist)
- *Fast-follow:* `activity_events`, `dish_share_links` (public links) arrive with their features.

### 4.6 Operations
- **`outbox`**: `kind` (email|backup_import|push|pusher|data_export|stripe_cancel|account_purge), `payload` (jsonb, re-validated by `outbox/jobs.ts` when drained), `status`, `attempts`, `run_after`, `last_error`. Realtime and push jobs are queued only when their provider is configured (`notify/queue.ts`)
- **`audit_log`**: `actor_id` (set null on purge), `action`, `target_type`, `target_id`, `meta`, `ip_hash`, `at`. Every admin action writes one inside its transaction (`admin.*`), plus account events (`auth.*`, `account.*`)
- **`feedback`**: `user_id` (set null), `kind` (bug|feature|other), `message` (≤4000), `locale`, `user_agent`, `status` (open|resolved), `resolved_at`; 5 per hour per person (counted in the table); admins get a push (`adminFeedback`, not switchable)
- **`data_exports`**: `user_id`, `status` (queued|running|ready|failed), `object_key` (R2 `u/{userId}/exports/{id}.json`), `content` (only when R2 isn't configured, local development), `size_bytes`, `expires_at` (24 h), `finished_at`
- *Fast-follow:* `reminders` and server-side `timer_alerts` (today a running timer notifies from the open tab; it respects the "timers" preference).

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
   - The limit is `plan_limits[entitlement.plan][feature]`. The period is the UTC calendar month for Free and the billing period for paid plans. Yearly subscribers get **monthly** allowances anchored to their billing day (the PRD lists paid limits "/ month"); spins count per UTC day (`src/server/quota/periods.ts`).
   - Features come in three kinds (`src/lib/plan-features.ts`): metered (a counter per period), counted (a cap on how many exist, e.g. dishes) and gated (limit 0 = not on this plan, null = unlimited). `meteredAction(feature)` reserves, then commits on success or refunds on failure; counted and gated checks are `canAddAnother()` / `hasFeature()`.
   - A paid entitlement more than a day past its period end counts as Free until a webhook or the reconcile job rewrites it.
3. **Subscription Pipeline:**
   - `startCheckout(plan, interval)` gets or creates the Stripe Customer, first mirrors that customer's subscriptions from Stripe (a subscription whose webhooks haven't landed still blocks a second one), then creates a Checkout Session (with a trial only if neither the account nor its inbox had one: `trialUsed()`) and returns the redirect URL.
   - Stripe → `/api/webhooks/stripe`: verify the signature on the raw body → fetch the subscription fresh from Stripe (events can arrive out of order) → in one transaction: dedupe on `stripe_events`, upsert `subscriptions`, recompute `entitlements`, audit plan changes, queue lifecycle emails (trial ending, payment failed, cancellation, receipt) in the outbox. A failure returns 500 and keeps nothing, so Stripe's retry starts clean.
   - **Grace:** the first `invoice.payment_failed` stamps `payment_failed_at` (retries don't move it); `past_due` keeps the plan for 7 days from then; `invoice.paid` clears it. A running admin comp is never downgraded by billing.
   - The success page reads entitlements from the DB, never from the query string. `openBillingPortal()` works the same way.
   - A nightly reconcile (`/api/cron/billing-reconcile`) re-lists every billing customer's subscriptions from Stripe (finding ones whose webhooks were all lost), re-syncs any other non-canceled mirrored subscription, logs an error for anyone with two live subscriptions, and recomputes every entitlement, which also ends expired grace periods. `/api/cron/release-reservations` frees tries whose request never reported back. `/api/cron/purge-deleted` (daily) removes dishes and collections deleted more than a day ago, and backup import summaries older than 30 days.
   - **Downgrade** marks over-limit content read-only by checks (`dishes count > limit` → block create); nothing is deleted.
4. **Auth Pipeline (Better Auth):**
   - Email/password and Google/Apple. Email verification is required. 2FA and passkeys come from plugins.
   - Better Auth handles its own rate limiting (production only), plus Upstash burst limits in our actions (production only) and the HIBP check before setting a password.
   - **Progressive lockout** (`src/server/auth/lockout*.ts`): failed password logins per email (stored as a keyed hash, also for unknown emails) lock for 1 min / 5 min / 30 min / 2 h at 5 / 10 / 15 / 20 failures; forgotten after a quiet day, a correct password or a password reset. It runs in Better Auth's before/after hooks on `/sign-in/email`, so it guards both our action and the raw endpoint. 2FA codes use the plugin's own lockout (5 tries → 15 min).
   - Google/Apple sign-in starts with a Server Action (`startSocialSignIn` returns the provider URL; Better Auth keeps the OAuth state in a cookie) and finishes at `/api/auth/callback/<provider>`. Accounts link by verified email only when both sides verified it, so pre-registering someone else's address can't capture their Google login (covered by an integration test with a mocked Google token endpoint).
   - Roles and suspension come from Better Auth's admin plugin (ban = suspend). Suspended accounts are refused at sign-in and count as signed out everywhere. `adminAction` checks the role from the database session; `pnpm admin:set <email> [--revoke]` grants it and writes the audit log.
   - 2FA (TOTP + 10 backup codes) and passkeys come from Better Auth plugins. Passkey ceremonies run through Server Actions (options → `@simplewebauthn/browser` → verify); the browser never calls `/api/auth` directly.
   - The proxy does only a fast cookie-presence gate. The data layer validates the session against the DB on every request (cached per request).
   - Signing out or a password change revokes sessions. A cascade removes those devices' push subscriptions, and the client wipes offline data.
   - Auth emails are sent through the outbox → Resend.
5. **Weather & Top-bar Chip Pipeline:**
   - Saving the kitchen with a typed city (and no device coordinates) geocodes it server-side (Open-Meteo geocoding) and stores rough coordinates; typing a city clears device coordinates. An unknown city is saved as typed and the chip says it wasn't found.
   - The `(app)` layout streams the chip behind `<Suspense>` (`app/[locale]/(app)/_parts/weather-chip-slot.tsx`), so a slow lookup never blocks the page.
   - It checks Redis under `cooky:wx:{lat.1}:{lon.1}` (coordinates rounded to 0.1°, 30-min TTL; an in-memory map when Upstash isn't configured). On a miss, it fetches Open-Meteo (`customer-api` with `OPEN_METEO_API_KEY`; without a key, the free endpoint in development only, and no weather in production) `current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day` (3 s timeout).
   - **WMO code → condition:** 0–1 → `sunny`/`clear_night` (by `is_day`) · 2–3 → `cloudy` · 45, 48 → `foggy` · 51–67, 80–82 → `rainy` · 71–77, 85–86 → `snowy` · 95–99 → `stormy`. Wind ≥ 40 km/h turns sunny/cloudy into `windy`. Accent: ≥ 30 °C → `hot`, ≤ 0 °C → `freezing`.
   - The same result gives the ranking mood (`cozy`/`light`/`neutral`) for Cook, Spin and the Assistant.
   - DTO: `{ condition, accent, tempC, feelsLikeC, windKmh, precipMm, isDay, mood }` plus the hemisphere `season` (meteorological, flipped south of the equator), with no coordinates and no provider URL. `loadWeatherContext(userId)` is the one source for the chip, Cook, Spin and the Assistant.
   - On failure, the chip hides and the mood is neutral.
6. **Ingredient Matching Service:**
   - `normalize()` folds case and accents, unifies Arabic letter forms (أ/إ/آ→ا, ة→ه, ى→ي), and strips the article "ال" from words longer than 3 letters.
   - `matches(line, wanted)`: every wanted word prefix-matches some word of the line, and words under 3 letters must match exactly.
   - `filter(dishes, wanted[])` → `{ mode: "all" | "any" | "none", dishes }`.
   - Autocomplete (`suggestIngredients`) ranks dictionary entries by word-start match, then `pg_trgm` similarity, shown in the current locale, then the person's own unlinked names. My Dishes search uses `matches()` on dish names and ingredients, plus trigram similarity for typos.
   - The shopping merge keys on `ingredient_id` when linked, otherwise on the normalized name. Amounts are summed when units convert (g↔kg, ml↔l, tsp↔tbsp…).
7. **Cook / Spin Pipeline:**
   - `rankDishes` (`features/cook/service.ts`, pure): a line is had when a kitchen item has the same dictionary entry, or every word of the item matches the line. Sort by missing count, then weather fit (dish season in the mood's favoured seasons > no season > other season), dietary fit, then recency (cooked in the last 3 days goes down; never cooked counts as 30 days). Missing names show in the viewer's language when linked to the dictionary. Cook's what-if bar uses `?with=` (extra names) and `?without=` (kitchen item ids) and never changes the kitchen.
   - `spinDish` (`meteredAction("spins")`): the pool is narrowed by an owned collection and/or up to 10 ingredients (all, then any, reported as `matchMode`), minus today's picks, then a weighted draw (weather fit ×3/×2/×1). Nothing left → `not_found` and the spin is refunded.
   - Cooking mode (`/dishes/[id]/cook`): ingredients, one step per screen (XL text), step timers that keep running across steps and ring with a beep and vibration, Screen Wake Lock, swipe and arrow keys (mirrored in RTL), then Log it (with "used up?" kitchen items) and a rating.
8. **Assistant Pipeline:**
   - `askAssistant(threadId?, text)` → reserve a try → load the context (dishes, catalog, last 14 days of cooking, weather, pantry, dietary prefs; upcoming events join in Phase 5) and the last 10 turns (ordered by `created_at`, then the UUID v7 id, since a turn's two rows share a transaction timestamp). Models: `AI_CHAT_MODEL` on Groq, `AI_FALLBACK_MODEL` on OpenAI (`server/ai/chat.ts`, `generateStructured`). Without either key the page says the Assistant isn't available and nothing is charged.
   - **Shortlist** ≤40 own + ≤16 Discover candidates ranked against the conversation, shown to the model as short aliases (`m3`, `d12`).
   - AI SDK structured output with a Zod schema `{ reply, picks: [{ id, why }] }`. Groq primary → OpenAI fallback on 429/5xx, with a 25 s timeout.
   - Unknown ids are dropped, the messages persisted, the try committed, and a DTO returned.
   - User and dish text are treated as data, never instructions. The model has no tools with side effects.
   - Cards are re-hydrated from the DB when shown (a deleted dish disappears). Voice questions go through `transcribeQuestion` (a voice try) into the message box, to check before sending. Threads untouched for 90 days are pruned by the daily `purge-deleted` job.
9. **Voice Pipeline:** The client records with MediaRecorder (≤ 60 s; under 2 KB nothing is sent) → `dictateIngredients(formData)` (`meteredAction("voice")`, ≤ 4 MB, magic bytes sniffed: webm/ogg/mp4/wav/mp3) → AI SDK `transcribe` with a per-locale style prompt, Groq (`AI_TRANSCRIBE_MODEL`, default `whisper-large-v3-turbo`) then OpenAI, 25 s timeout → `splitIngredientText` + `parseIngredientLine` (EN/FR/AR units, fractions, Arabic digits) → ingredient rows appended to the form. Nothing heard → `not_found`; no provider configured or both failing → `unavailable`; both refund the try. The keys are optional: without them the button explains that voice is unavailable and typing always works.
10. **Upload Pipeline:** `uploadDishPhoto(formData)` / `uploadAvatar(formData)` (`server/actions/photos.ts`) → ownership + read-only check → ≤ 5 MB and magic bytes (`storage/image.ts`: JPEG, PNG, WebP, GIF, AVIF; HEIC refused, and the picker's `accept` makes iPhones send JPEG) → `sharp` (EXIF auto-orient, 40 MP input cap, WebP q80, no metadata kept): dish 1280 px inside + 480×360 cover, avatar 512² + 96² cover with attention crop (server-side, instead of a client crop step) → R2 `u/{userId}/{uuid}.webp` and `…-sm.webp` → swap the key under a row lock, then delete the replaced objects (best effort; failures stay under the owner's prefix for the account purge). Reads: 10-minute signed GET URLs go in the DTO only after the policy check (`photo`, `photoUrl`, `avatarUrl`); the UI uses plain `<img>` since the URLs change per render. The daily purge deletes a purged dish's objects. Without all four `R2_*` variables, `storageConfigured()` is false: pickers say uploads aren't available and nothing else changes. An imported recipe's `image` is fetched through the importer's guard (`fetchImage`) and stored on save, best effort. On the new-dish form the picked photo stays on the device (shown from a `blob:` URL) until `createDish` returns the id, then goes through `uploadDishPhoto`; a picked photo skips fetching the imported one, and a failed upload keeps the dish and says so (the dish page offers "Add a photo").
11. **Realtime & Notifications:**
    - Each person listens on `private-user-{userId}`. pusher-js loads only when realtime is configured (`account.realtime`), and its `channelAuthorization.customHandler` calls the `authorizeRealtime` Server Action, which signs only the caller's own channel: there is no `/api/pusher/auth` route.
    - Events (`server/realtime/dto.ts`) carry ids only: `message` (new, to the recipient), `message_changed` (edit/delete/restore), `receipt` (delivered/seen), `typing` (sent by the composer at most every 4 s), `friends` (request/accept). They go through the outbox (`pusher` job), never straight from an action body.
    - The client refreshes through the server: the open thread refreshes itself; elsewhere `RealtimeShell` refreshes the badges, marks messages delivered, and shows an in-app toast with the sender's name (fetched by id).
    - Without Pusher, an open thread refreshes every 8 s while visible; the unread dot updates on navigation.
    - Web Push (`notify/push.ts`, `web-push` + VAPID): a subscription per device and session; the payload is rendered in the device's language and carries the sender's name, never message text; switched-off kinds are skipped; 404/410 subscriptions are deleted. The service worker skips the system notification while a Cooky window is focused. Billing lifecycle events push alongside their emails.
12. **Outbox & Jobs:**
    - QStash calls `/api/jobs/drain` (signature-verified) every minute, with exponential backoff (max 8 attempts → dead letter + alert).
    - Schedules (`pnpm jobs:schedule`, `scripts/schedule-jobs.ts`): `cleanup` hourly (expired sessions and verification tokens, expired export files and rows, delivered jobs older than 30 days), `release-reservations` every 5 min, `purge-deleted` daily (dishes, collections, old import summaries, deleted message text, assistant threads idle 90 days), `purge-accounts` daily, `billing-reconcile` daily.
    - A dead-lettered job is logged and sent to Sentry (`Outbox job dead-lettered`, tagged with its kind).
18. **Account deletion & data export (PRD §3.1):**
    - `requestAccountDeletion` re-checks the password (`auth.api.verifyPassword`), or for Google/Apple-only accounts requires a login from the last 15 minutes. In one transaction: queue `stripe_cancel` (live subscriptions cancelled now), the `accountDeletionScheduled` email, audit, then `status = pending_deletion`, `deletion_requested_at = now` and all sessions deleted. Logging in during the 7 days restores the account (Better Auth `session.create.after` hook).
    - `purge-accounts` (daily) runs `purgeAccount` for each account past the grace: delete the Stripe customer, delete every R2 object under `u/{userId}/`, delete the user row (everything owned cascades), audit `account.purged`. It's idempotent, and a failure is retried the next day.
    - Admin deletion bans the account at once (so a login can't cancel it) and queues `account_purge`.
    - `requestDataExport` (one per hour) queues `data_export`; the job builds JSON with `buildDataExport` (other people by display name only, no storage keys), stores it privately, and emails a link to Settings → Your data. The file streams from `/api/downloads/[id]?e=&s=`: an HMAC-signed, expiring link that also requires the owner's session.
13. **Email Pipeline:** React Email template (per locale) → outbox → Resend. Links are built from the validated `APP_URL`, never from the request. Tokens are single-use, hashed and short-lived.
14. **Recipe Import Pipeline:**
    - `importFromUrl(url)` → reserve a try.
    - **SSRF guard** (`server/importer/fetch.ts`, `ip.ts`): http(s) on default ports only, no credentials in the URL; every DNS answer is checked against private, loopback, link-local, CGNAT, multicast, documentation, IPv4-mapped and NAT64 ranges and the socket is pinned to the checked address (no rebinding); each redirect is re-checked (max 3); 8 s timeout; 3 MB cap measured after decompression; `text/html` only. Sites that block non-browser TLS clients (e.g. Allrecipes) answer 403 and get the "couldn't reach" message: we don't impersonate browsers.
    - `extractRecipe` reads JSON-LD `Recipe` (also inside `@graph` and arrays; `HowToStep`/`HowToSection`, `image`), clamps yield and counts, and credits `og:site_name` or the host. Pages without it go to `aiExtractRecipe` (same try): the page's readable text (≤ 12k chars) → structured `{ found, name, servings, ingredients[], steps[] }`, copied as written, then parsed like any line. No recipe either way → `not_found` (try refunded).
    - The result is a **draft DTO** shown in the dish form; nothing is saved until the user confirms. On save, `dish_sources` keeps the link and the dish page shows "From {site}". Copying the photo waits on uploads (3f).
    - The PWA `share_target` (in `app/manifest.ts`) is a GET to `/en/dishes/new?title&text&url`; the page pre-fills the first http(s) link and never imports on its own.
15. **Offline Shopping Sync:**
    - With the setting on, the shopping and cooking-mode pages pass the client a versioned snapshot DTO of the user's own active list and today's recipe. The client stores it in IndexedDB under the user id.
    - Offline check-offs are queued as `{ itemId, checked, at }`. On reconnect they replay through `toggleShoppingItem` (idempotent, last-write-wins by `at`), then the client reloads the server version.
    - Logout, session revoke or a user switch wipes the store. The login response carries a `clear-offline` instruction.
16. **Reminders & Timer Alerts:**
    - An hourly schedule selects `reminders` due in each user's timezone, skipping quiet hours and users with nothing relevant (e.g. no event tomorrow), then the outbox delivers localized push/email.
    - Starting a named timer schedules a QStash delayed message for `fires_at`. Cancelling it cancels the message, and on firing the job sends the push.
17. **Catalog Pipeline:** A seed script (TheMealDB-style source data copied into our DB, never called at runtime) plus translation files, then admin CRUD. Saved copies keep FK links, so reads show the current locale's translation until the user edits the copy.
