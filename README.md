# Cooky

<div align="center">

<img src="public/icons/icon-512.png" alt="Cooky Logo" width="128" height="128" style="border-radius: 28px; box-shadow: 0 12px 36px rgba(0,0,0,0.12);" />

### The Multilingual, Server-Authoritative Culinary Companion & Meal Planning Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_Strict-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-4169E1?style=flat&logo=postgresql)](https://neon.tech/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=flat&logo=drizzle)](https://orm.drizzle.team/)
[![Better Auth](https://img.shields.io/badge/Auth-Better_Auth_Passkeys-FF4154?style=flat)](https://www.better-auth.com/)
[![Stripe](https://img.shields.io/badge/Payments-Stripe_Billing-635BFF?style=flat&logo=stripe)](https://stripe.com/)
[![i18n](<https://img.shields.io/badge/i18n-EN_%7C_FR_%7C_AR_(RTL)-brightgreen>)](https://next-intl-docs.vercel.app/)
[![PWA](https://img.shields.io/badge/PWA-Offline_Ready-purple?style=flat&logo=pwa)](https://web.dev/progressive-web-apps/)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG_2.2_AA-success?style=flat)](https://www.w3.org/WAI/standards-guidelines/wcag/)

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#core-capabilities">Key Features</a> •
  <a href="#system-architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#zero-leak-security-model">Security & Zero-Leak</a> •
  <a href="#database-schema">Data Model</a> •
  <a href="#subscription-tiers--quotas">Billing & Tries</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment</a> •
  <a href="#background-jobs">Background Jobs</a> •
  <a href="#quality-engineering">Testing</a> •
  <a href="#deployment">Deployment</a>
</p>

</div>

---

## Overview

**Cooky** is a modern, high-performance home-cooking companion and kitchen management platform designed from the ground up for international audiences (English, French, and full right-to-left Arabic). Cooky tackles everyday culinary friction: answering _"what do I cook today?"_ based on available kitchen pantry inventory, local weather conditions, dietary restrictions, and seasonal availability.

From intuitive decision-making to kitchen execution, Cooky unifies:

- **Intelligent Decision Engine**: Algorithmic recipe ranking, weighted spin wheel, and context-grounded AI culinary assistance.
- **Structured Recipe Management**: Scalable recipes, ingredient dictionary with dialect matching, voice dictation, and SSRF-guarded recipe link import.
- **End-to-End Kitchen Planning**: Drag-and-drop weekly meal scheduling, guest event menus, automated aisle-grouped shopping lists with offline sync, and screen-awake cooking mode with step timers.
- **Social & Collaborative Cooking**: Friend networks, granular sharing circles, zero-leak real-time messaging, shared dish cards, and verified cooking reviews.
- **Production-Grade Engineering**: Server-authoritative execution, strict Data Transfer Object (DTO) boundary protection, transactional outbox side effects, and nonced Content Security Policy.

---

## Core Capabilities

### 1. Smart Decision Engine

- **Cook (Pantry-First Ranking)**: Evaluates user recipes and curated dishes against current kitchen inventory. Prioritizes dishes with the fewest missing ingredients, adjusted for local weather feel and cooking recency.
- **My Kitchen (Pantry)**: Tracks active kitchen ingredients alongside "always-have" staples (salt, oil, spices). Features a live, reactive **Ready to Cook** panel displaying makeable meals and recipes just 1–2 items short.
- **The Spin Wheel**: Weighted randomized meal selection taking into account active seasons, local weather, and chosen pantry filters with daily fair-use limits.
- **Weather-Aware Recommendations**: Integrated Open-Meteo telemetry cached in Redis. Displays an animated weather chip with mood classification—surfacing cozy stews on rainy/cold days and light meals in warm weather.
- **Grounded AI Assistant**: Multi-turn culinary chat powered by the Vercel AI SDK with automatic provider fallback (Groq Llama 3 $\rightarrow$ OpenAI GPT). Formulates actionable suggestions grounded exclusively in real database recipes without hallucinating dishes.

### 2. Recipe Box & Catalog

- **Structured Recipe Editor**: Structured ingredients (amounts, units, preparation notes), course classifications, difficulty ratings, seasonal tags, macro nutritional breakdowns, and step-by-step instructions.
- **Proportional Scaling**: Real-time recipe scaling ($N$ servings) with dynamic metric/imperial unit conversions.
- **Recipe Link Import**: PWA Share Target (`Share → Cooky`) and URL importer backed by pinned-DNS SSRF protection, Schema.org JSON-LD parsing, and LLM extraction fallback.
- **Voice Dictation**: Natural speech dictation (Groq/OpenAI Whisper) converted directly into structured ingredient entries.
- **Global Discover Catalog**: Admin-curated, trilingual recipe catalog representing 12+ international culinary traditions, supplemented by an automated TheMealDB ingestion pipeline with allergen-safe dietary classification.
- **Media Optimization**: Private Cloudflare R2 bucket with sharp image re-encoding (WebP format), complete EXIF/GPS stripping, and short-lived signed URLs (10-minute expiry).

### 3. Planning, Shopping & Execution

- **Weekly Meal Planner**: Interactive drag-and-drop meal planning (`@dnd-kit`) supporting breakfast, lunch, and dinner slots—plus Suhoor and Iftar slots when Ramadan Mode is activated. Includes "Copy last week", slot repetition, and AI "Fill my week".
- **Events & Hosting**: Multi-course menu management (1–500 guests) with automated ingredient scaling and single-tap menu shopping generation.
- **Merged Shopping List**: Intelligent cross-recipe ingredient consolidation, automatic unit conversion, grocery aisle categorization, manual item additions, and staple exclusion.
- **Offline PWA Architecture**: Explicit IndexedDB storage exception for active shopping lists and today's recipe. Allows shoppers to check items off without connectivity; actions are queued and replayed upon reconnect, wiped on logout or remote session revocation.
- **Cooking Mode & Kitchen Timers**: High-contrast, distraction-free screen view with Wake Lock API integration. Supports multiple concurrent named countdown timers ("Rice", "Oven") with sound alerts and background Web Push notifications.
- **Calendar & iCal Sync**: Visual monthly timeline of past cooks and upcoming meal plans, featuring a private, revocable iCal subscription URL (Pro tier) for Google Calendar and Apple Calendar.

### 4. Social Collaboration & Community

- **Friend Connections & Circles**: Privacy-first friend requests (searched by exact email or handle) with rate limiting (20/hr) and 30-day decline cooldowns. Custom friend groups (Family, Work) govern granular recipe visibility.
- **Real-Time 1:1 Messaging**: Private channels powered by Pusher Channels. Architecture guarantees zero data leakage on the wire—WebSocket events carry identifiers only (`{ type, conversationId }`), prompting the client to refresh through authenticated server actions. Includes typing indicators, read receipts, and interactive recipe card attachments.
- **Verified Cook Reviews**: 1–5 star ratings and reviews restricted to users who have logged cooking the dish. Copies of shared recipes rate the original creator's recipe.
- **Public Share Links**: Secure, revocable read-only links generating dynamic localized Open Graph preview cards for social platforms.

### 5. Cultural Adaptation & Ramadan Mode

- **Full Trilingual Localization**: Comprehensive English (`en`), French (`fr`), and Modern Standard Arabic (`ar`) localization via `next-intl`. Built using CSS logical properties (`ms-`, `me-`, `ps-`, `pe-`) and mirrored directional icons for native RTL navigation.
- **Regional Dialect Normalization**: Ingredient matching engine accommodates North African (Maghreb) and Middle Eastern (Mashreq) naming variations, Arabic prefix folding ("ال"), and accent-agnostic search.
- **Ramadan Mode**: Custom profile mode offering Suhoor and Iftar meal slots, location-accurate Adhan prayer calculations for Iftar countdowns, Ramadan catalog collections, and fasting-tailored assistant prompts.

### 6. Administration & Operations Suite

- **Executive Metrics Dashboard**: Real-time tracking of Monthly Recurring Revenue (MRR), subscription statuses, trial conversion, feature try consumption, and user growth.
- **Catalog Management**: Centralized CRUD interface for catalog recipes featuring translation coverage indicators across English, French, and Arabic.
- **User & Content Moderation**: User management (suspension, role assignments, complimentary subscriptions), review deletion, shared dish visibility toggling, and user report queue resolution.
- **Feedback & Audit Logging**: User feedback inbox with client metadata and comprehensive audit logs recording every administrative and security-sensitive action.
- **GDPR Compliance**: User data export pipeline generating temporary signed archives, paired with a 7-day grace period account deletion flow with cascading cleanup.

---

## System Architecture

Cooky adheres to a strict **server-authoritative execution model**: the client renders presentation data and forwards user intents, while all business logic, validation, permission enforcement, quotas, and third-party integrations execute on the server.

```
+-------------------------------------------------------------------------------+
|                 Client Browser / Installed PWA (EN · FR · AR RTL)             |
|   • Dumb UI rendering typed DTO props      • Optimistic UI with rollback       |
|   • Service Worker (static cache, offline)  • IndexedDB: Active list & recipe  |
+---------------------------------------+---------------------------------------+
                                        | HTTPS (RSC & Server Actions)
                                        | WSS (Private channels, IDs-only)
                                        v
+-------------------------------------------------------------------------------+
|                      Next.js App Router (Vercel Edge/Node)                    |
|   • proxy.ts: Locale routing, session gate, per-request nonce CSP             |
|   • Server Actions Pipeline: Auth -> Policy -> Zod -> Quota -> RateLimit -> Tx |
|   • Features Layer: Domain services, Drizzle queries, DTO mappers             |
|   • API Endpoints: Better Auth, Stripe webhooks, QStash jobs, iCal, downloads |
+----+---------------+------------------+------------------+--------------------+
     | Drizzle (Pool)| REST             | S3 Presigner     | REST / SDK
     v               v                  v                  v
+----------+   +------------+   +---------------+   +---------------------------+
| Postgres |   |  Upstash   |   | Cloudflare R2 |   | External Services         |
|  (Neon)  |   |   Redis    |   | Private store |   | • Pusher (WebSockets)     |
| Data,    |   | Rate limit |   | Signed URLs   |   | • Resend (React Email)    |
| Sessions,|   | Weather    |   | Sharp WebP    |   | • Groq / OpenAI (AI SDK)  |
| Tries,   |   +------------+   +---------------+   | • Stripe (Billing/Portal) |
| Outbox,  |         ^                              | • Open-Meteo (Weather)    |
| Audit    |         | Cron / Worker                | • Web Push (VAPID)        |
+----------+   +------------+                       +---------------------------+
               |  Upstash   |
               |   QStash   |
               +------------+
```

### Server Actions Mutation Pipeline

Every state mutation executes through `next-safe-action` clients (`publicAction`, `userAction`, `adminAction`, `meteredAction`), enforcing an 8-step pipeline:

1. **Authentication**: Resolves session directly from PostgreSQL, rejecting banned or deletion-pending accounts.
2. **Input Validation**: Strict Zod schemas validating types, bounds, strings, UUIDs, and enums.
3. **Authorization Policy**: Contextual ownership checks (`features/<feature>/policy.ts`).
4. **Quota Reservation**: For metered capabilities, reserves a try against `plan_limits`; commits on success, automatically refunds on external failure.
5. **Rate Limiting**: Sliding-window burst rate limiting via Upstash Redis keyed by user ID or IP address.
6. **Database Transaction**: Atomic multi-step operations executed within PostgreSQL transactions (`db.transaction`).
7. **Transactional Outbox & Audit**: Queues asynchronous notifications (email, push, realtime) and logs audit records within the same transaction.
8. **Cache Invalidation & DTO Return**: Triggers Next.js `revalidatePath`/`revalidateTag` and returns minimal DTO representations.

---

## Zero-Leak Security Model

Cooky implements defense-in-depth isolation to guarantee that no internal credentials, database structures, or unauthorized data cross to the client:

- **`server-only` Enforcement**: All server files import `server-only`. Architectural boundaries are validated at build time via `eslint-plugin-boundaries` (ensuring `src/components/` only ever imports actions, DTO types, and UI utilities).
- **Object Tainting**: Sensitive objects (user records, auth sessions, secrets) are tainted at retrieval using `experimental_taintObjectReference` and `experimental_taintUniqueValue` to prevent accidental serialization into React Server Component payloads.
- **Strict Data Transfer Objects (DTOs)**: The client never receives raw database rows. DTO mappers strip internal columns, third-party identifiers, other users' emails, and quota formulas.
- **Nonce-Based Content Security Policy**: Dynamic per-request nonces (`'strict-dynamic'`) generated in `src/proxy.ts`. Inline script execution is blocked. External network connections are strictly restricted to `'self'` and Pusher Channels (`connect-src`).
- **No Client Third-Party Calls**: All communication with OpenAI, Groq, Stripe, Resend, Cloudflare R2, and Open-Meteo is strictly brokered by the server.
- **SSRF-Guarded Link Ingestion**: Link importing enforces DNS resolution checks to block private, loopback, link-local, and reserved IP ranges prior to dispatching outbound HTTP requests.

---

## Tech Stack

| Domain                      | Technology                                                                            | Description                                                                                    |
| :-------------------------- | :------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------- |
| **Framework**               | [Next.js 16 (App Router)](https://nextjs.org/)                                        | Dynamic SSR, Server Components, Server Actions, Route Handlers, Turbopack                      |
| **Frontend Core**           | [React 19](https://react.dev/) + [TypeScript Strict](https://www.typescriptlang.org/) | Concurrent features, React Compiler, zero-`any` type safety                                    |
| **Styling & UI**            | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)     | Radix UI primitives, design tokens, light/dark/system themes, 6 accent palettes                |
| **Database**                | [PostgreSQL on Neon](https://neon.tech/)                                              | Serverless Postgres, connection pooling, branch-per-preview workflows                          |
| **ORM & Migrations**        | [Drizzle ORM](https://orm.drizzle.team/) + `drizzle-kit`                              | TypeScript schema declaration, SQL migration generator                                         |
| **Authentication**          | [Better Auth](https://www.better-auth.com/)                                           | Database sessions, Passkeys (WebAuthn), 2FA (TOTP), Google/Apple OAuth, HIBP password auditing |
| **Caching & Rate Limiting** | [Upstash Redis](https://upstash.com/redis)                                            | Serverless Redis, `@upstash/ratelimit` sliding-window limiting, weather caching                |
| **Background Jobs**         | [Upstash QStash](https://upstash.com/qstash)                                          | Cron scheduling, transactional outbox consumer, delayed push notifications                     |
| **Billing & Payments**      | [Stripe](https://stripe.com/)                                                         | Stripe Checkout, Customer Portal, Stripe Tax, webhook idempotency                              |
| **AI Integration**          | [Vercel AI SDK](https://sdk.vercel.ai/)                                               | Groq (Llama 3 / Whisper) + OpenAI (GPT / Whisper) fallback pipeline                            |
| **Object Storage**          | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/)                    | S3-compatible zero-egress object storage, signed URL generation                                |
| **Image Processing**        | [sharp](https://sharp.pixelplumbing.com/)                                             | Image re-encoding, WebP compression, metadata and EXIF stripping                               |
| **Realtime**                | [Pusher Channels](https://pusher.com/channels)                                        | Server-signed private WebSocket channels with IDs-only event dispatch                          |
| **Email Delivery**          | [Resend](https://resend.com/) + [React Email](https://react.email/)                   | Localized transactional email templates (EN, FR, AR)                                           |
| **Push Notifications**      | [Web Push (VAPID)](https://github.com/web-push-libs/web-push)                         | Standards-compliant push notifications via browser push services                               |
| **Internationalization**    | [next-intl](https://next-intl-docs.vercel.app/)                                       | Locale routing (`/en`, `/fr`, `/ar`), ICU message format, full RTL layout                      |
| **Testing**                 | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)                 | Unit testing, jsdom component tests, integration tests against Postgres, E2E specs             |
| **Observability**           | [Pino](https://getpino.com/) + [Sentry](https://sentry.io/)                           | Structured JSON logging, contextual error tracking with PII scrubbing                          |

---

## Database Schema

Database structures are declared in `src/server/db/schema/` using Drizzle ORM, with primary keys utilizing time-ordered **UUID v7** identifiers.

```
                                  +----------------------+
                                  |        users         |
                                  +----------+-----------+
                                             |
         +-------------------+---------------+-------------------+--------------------+
         | 1:1               | 1:N           | 1:N               | 1:N                | 1:N
         v                   v               v                   v                    v
+-----------------+   +-------------+  +------------+   +-------------------+  +--------------+
|    profiles     |   |   dishes    |  |  planner   |   |   subscriptions   |  |   friends    |
| (pref, locale,  |   | (recipe,    |  |   events   |   | (Stripe status,   |  | (1:1 graph,  |
|  theme, units)  |   |  servings)  |  |  (meals)   |   |  billing period)  |  |  cooldowns)  |
+-----------------+   +------+------+  +------------+   +-------------------+  +-------+------+
                             |                                                         |
         +-------------------+--------------------+                                    v
         | 1:N                                    | 1:N                        +---------------+
         v                                        v                            | conversations |
+------------------+                    +-------------------+                  |  & messages   |
| dish_ingredients |                    |    dish_steps     |                  | (Pusher sync) |
+------------------+                    +-------------------+                  +---------------+
         |
         v
+------------------+
|   ingredients    | <---- Shared normalized dictionary (EN / FR / AR + dialect aliases)
+------------------+
```

### Core Domain Modules

- **Identity & Security (`auth.ts`, `accounts.ts`)**: User identities, session store, hashed credentials, passkey credentials, two-factor secrets, and accepted legal consent records.
- **Profiles & Preferences (`accounts.ts`)**: Display profiles, avatar keys, geographic coordinates, unit preferences (metric/imperial), dietary preferences, and Ramadan mode toggles.
- **Recipes & Catalog (`recipes.ts`)**: Dish definitions, structured ingredient lines, preparation steps with timer markers, collections, bookmarks, ratings, and catalog metadata.
- **Kitchen & Pantry (`cooking.ts`)**: Normalized ingredient dictionary, pantry inventory (`kitchen_items`), and categorized grocery lists (`shopping_items`).
- **Planning & Calendar (`cooking.ts`)**: Weekly scheduled meal slots, hosting events (`event_courses`), and chronological cook logs.
- **Social Graph & Realtime (`social.ts`)**: Bi-directional friend relationships, user blocks, private friend circles, chat threads, and message attachments.
- **Billing & Quotas (`billing.ts`)**: Stripe customer mapping, subscription records, global tier allowances (`plan_limits`), and user quota consumption counters (`user_tries`).
- **Reliability & Operations (`operations.ts`)**: Transactional outbox queue (`outbox`), administrative audit trails (`audit_log`), and user feedback submissions.

---

## Subscription Tiers & Quotas

Cooky offers a sustainable hybrid SaaS model featuring a functional Free tier and premium tiers for advanced kitchen planning and unconstrained AI assistance:

| Feature / Limit                            |      Free Tier       |   Plus (€3.99/mo · €35.99/yr)   | Pro (€7.99/mo · €69.99/yr) |
| :----------------------------------------- | :------------------: | :-----------------------------: | :------------------------: |
| **Recipe Box Capacity**                    |      50 dishes       |           500 dishes            |        2,000 dishes        |
| **Discover, Cook, Planner, Calendar**      |       Included       |            Included             |          Included          |
| **Recipe Scaling & Offline Shopping List** |       Included       |            Included             |          Included          |
| **Custom Recipe Collections**              |    3 collections     |            Unlimited            |         Unlimited          |
| **Daily Spin Wheel Limits**                |    3 spins / day     |         20 spins / day          |         Unlimited*         |
| **AI Assistant Questions**                 | **10 tries / month** |        150 tries / month        |     600 tries / month*     |
| **Voice Recipe Dictation**                 | **10 tries / month** |        100 tries / month        |     400 tries / month*     |
| **Link Recipe Import**                     | **5 tries / month**  |        50 tries / month         |     200 tries / month*     |
| **AI Course Suggestions & "Fill My Week"** |   Rule-based only    | Included (uses Assistant tries) |          Included          |
| **Active Hosting Events**                  |       2 events       |            Unlimited            |         Unlimited          |
| **Private Friend Groups**                  |       2 groups       |            10 groups            |         50 groups          |
| **Backup Archive Import**                  |          —           |            Included             |          Included          |
| **Shared Household Shopping List**         |          —           |                —                |          Included          |
| **Calendar iCal Feed Subscription**        |          —           |                —                |          Included          |
| **Free Trial Duration**                    |          —           |    7 days (once per account)    | 7 days (once per account)  |

_\*Subject to fair-use per-minute sliding window burst limits enforced by Upstash Redis._

### Metered Tries Mechanism

For AI, voice dictation, and recipe imports, Cooky employs an atomic reservation workflow:

1. The server atomically reserves a try slot against `user_tries` in PostgreSQL.
2. If quota is exceeded, the action immediately rejects with `quota_exceeded`, triggering the client Upgrade Sheet.
3. Upon external API execution failure, the reserved try is refunded immediately to the user's balance.

---

## Getting Started

### Prerequisites

- **Node.js**: Version `>= 22.13.0`
- **Package Manager**: `pnpm` (Version `>= 12.11.2`)
- **PostgreSQL**: Neon serverless database or standard Postgres instance (with `pg_trgm` and `unaccent` extensions enabled)
- **Redis**: Upstash Redis database (REST-compatible)

### Installation & Local Setup

1. **Clone the repository**:

   ```sh
   git clone https://github.com/TakiHilalSoftware/Cooky.git
   cd Cooky
   ```

2. **Install project dependencies**:

   ```sh
   pnpm install
   ```

3. **Configure environment variables**:
   Create a local configuration file from the template:

   ```sh
   cp .env.example .env.local
   ```

   _Populate `.env.local` with your database credentials, auth secrets, and integration keys (see [Environment Configuration](#environment-variables))._

4. **Initialize database schema and seed data**:

   ```sh
   # Generate and apply database migrations
   pnpm db:migrate

   # Seed default plan limits, ingredient dictionary, and catalog dishes
   pnpm db:seed
   ```

5. **Start the development server**:

   ```sh
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Promote an administrative account**:
   Once you have registered your initial user account through the UI, grant administrative privileges:
   ```sh
   pnpm admin:set you@yourdomain.com
   ```

---

## Environment Variables

All environment variables are strictly validated on boot using `@t3-oss/env-nextjs` and Zod (`src/server/env.ts`). In deployed environments (`VERCEL_ENV=production|preview`) or when running with `COOKY_STRICT_ENV=1`, missing required variables will halt the build.

### Public Client Variables (Allow-List)

_The only variables permitted to reach client JavaScript:_

- `NEXT_PUBLIC_APP_URL`: Canonical HTTPS URL of the application.
- `NEXT_PUBLIC_PUSHER_KEY`: Public key for Pusher Channels.
- `NEXT_PUBLIC_PUSHER_CLUSTER`: Pusher cluster identifier (e.g., `eu`).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Base64 VAPID public key for Web Push.
- `NEXT_PUBLIC_SENTRY_DSN`: Client-side Sentry DSN (optional).

### Server Variables

| Variable                                                              | Description                                                       |                Requirement                |
| :-------------------------------------------------------------------- | :---------------------------------------------------------------- | :---------------------------------------: |
| `DATABASE_URL`                                                        | Neon pooled PostgreSQL connection string                          |               **Required**                |
| `DATABASE_URL_UNPOOLED`                                               | Neon direct connection string (used by Drizzle migrations)        |               **Required**                |
| `BETTER_AUTH_SECRET`                                                  | 32+ character secret used to sign session cookies and tokens      |               **Required**                |
| `BETTER_AUTH_URL`                                                     | Application root URL matching `NEXT_PUBLIC_APP_URL`               |               **Required**                |
| `CRON_SECRET`                                                         | 32+ character authorization key for internal cron route endpoints |               **Required**                |
| `GOOGLE_CLIENT_ID` / `_SECRET`                                        | Google Cloud OAuth 2.0 Web Client credentials                     |               **Required**                |
| `STRIPE_SECRET_KEY`                                                   | Stripe secret API key (`sk_test_...` or `sk_live_...`)            |               **Required**                |
| `STRIPE_WEBHOOK_SECRET`                                               | Stripe webhook signing secret (`whsec_...`)                       |               **Required**                |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`                                   | Upstash Redis connection endpoint and bearer token                |               **Required**                |
| `QSTASH_TOKEN`                                                        | Upstash QStash authorization token for background jobs            |               **Required**                |
| `QSTASH_CURRENT_SIGNING_KEY`                                          | Primary verification key for QStash webhook validation            |               **Required**                |
| `QSTASH_NEXT_SIGNING_KEY`                                             | Next verification key for seamless QStash secret rotation         |               **Required**                |
| `RESEND_API_KEY`                                                      | Resend API key (`re_...`)                                         |               **Required**                |
| `EMAIL_FROM`                                                          | Verified sender address (e.g. `Cooky <hello@yourdomain.com>`)     |            **Required (Prod)**            |
| `R2_ACCOUNT_ID` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_BUCKET` | Cloudflare R2 credentials for photo uploads                       |        Optional (Feature-flagged)         |
| `PUSHER_APP_ID` / `PUSHER_SECRET`                                     | Pusher Channels backend credentials                               | Optional (Realtime falls back to polling) |
| `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`                                 | VAPID private key and contact URI for Web Push                    |     Optional (Push disabled if unset)     |
| `GROQ_API_KEY`                                                        | Primary LLM and transcription provider (Groq)                     |      Optional (AI disabled if unset)      |
| `OPENAI_API_KEY`                                                      | Fallback LLM and transcription provider (OpenAI)                  |                 Optional                  |
| `OPEN_METEO_API_KEY`                                                  | Open-Meteo commercial API key                                     |       Optional (Dev uses free tier)       |

---

## Background Jobs & Transactional Outbox

Asynchronous side effects and maintenance jobs are managed using PostgreSQL as a transactional outbox, drained reliably by **Upstash QStash**.

```
[Server Action Mutation]
          |
          +---> 1. Write business entity
          +---> 2. Insert outbox task (PENDING)  --- In ONE Postgres Transaction
          +---> 3. Insert audit log
                                 |
                                 v
[QStash Scheduled Trigger] ---> /api/jobs/drain
                                 |
                                 v
                   [Worker executes task handlers]
                   • Send Resend email
                   • Dispatch Web Push notification
                   • Trigger Pusher realtime channel
                   • Mark outbox record COMPLETED
```

### Registered Schedules (`pnpm jobs:schedule`)

- `cooky-outbox-drain`: Runs **every minute** to drain pending transactional tasks.
- `cooky-stale-tries`: Runs **every 5 minutes** to reclaim uncommitted quota reservations.
- `cooky-cleanup-hourly`: Runs **every hour** to purge expired sessions, consumed tokens, and old export archives.
- `cooky-purge-daily`: Runs **daily** to delete orphaned dish drafts and conversations older than retention thresholds (90 days).
- `cooky-account-purge-daily`: Runs **daily** to permanently purge accounts that have exceeded their 7-day deletion grace window (cascading database records, Cloudflare R2 files, and Stripe customers).
- `cooky-stripe-reconcile-daily`: Runs **daily** to reconcile database subscription entitlements against Stripe records.

---

## Quality Engineering

Cooky enforces strict quality gates across linting, type safety, boundaries, unit testing, integration tests, and end-to-end browser journeys.

### Available Quality Commands

```sh
# Run full verification suite (lint, typecheck, and unit/component tests)
pnpm check

# Execute unit and component tests via Vitest
pnpm test

# Run integration tests against real PostgreSQL instance
pnpm test:integration

# Execute end-to-end browser specifications via Playwright
pnpm test:e2e

# Run architectural boundary and ESLint checks
pnpm lint

# Run TypeScript compilation check
pnpm typecheck
```

### Testing Strategy

- **Unit Tests (`src/**/*.test.ts`)**: Fast, pure business logic validation including recipe ingredient matching, dialect normalization, recipe scaling, tries mathematics, and weather condition mappings.
- **Component Tests (`src/**/*.test.tsx`)**: Render testing via React Testing Library and jsdom covering interactive forms, drag-and-drop mechanics, and offline queue status.
- **Integration Tests (`tests/integration/`)**: Validates Server Actions against a live PostgreSQL test database with external providers mocked using Mock Service Worker (MSW). Covers access policies, concurrency limits, and webhook idempotency.
- **E2E Tests (`e2e/`)**: Playwright suites exercising critical user journeys: authentication flows, Passkey registration, Stripe billing lifecycles via Stripe Test Clocks, offline shopping list synchronization, and realtime chat.

---

## Deployment

Cooky is designed for automated continuous deployment on **Vercel** paired with **Neon PostgreSQL**.

### Production Release Checklist

1. **Neon Database Setup**:
   - Provision a production Neon project.
   - Configure connection pooling (`DATABASE_URL`) and direct access (`DATABASE_URL_UNPOOLED`).
   - Run database migrations: `pnpm db:migrate`.
   - Seed baseline records: `pnpm db:seed`.
2. **Environment Variables**:
   - Configure all variables from `.env.example` in **Vercel → Settings → Environment Variables**.
   - Verify strict compilation locally before deploying:
     ```sh
     COOKY_STRICT_ENV=1 pnpm build
     ```
3. **Stripe Production Configuration**:
   - Synchronize live billing products and prices:
     ```sh
     pnpm stripe:sync --live
     ```
   - Register webhook endpoint `https://yourdomain.com/api/webhooks/stripe` and store the webhook secret in Vercel.
4. **Register QStash Cron Schedulers**:
   - Register outbox drain and maintenance routines against your live production domain:
     ```sh
     pnpm jobs:schedule https://yourdomain.com
     ```
5. **Initial Administrator Account**:
   - Complete initial account signup, then execute `pnpm admin:set admin@yourdomain.com`.

---

## Repository Structure

```tree
cooky/
├── .github/workflows/         # CI/CD pipelines (lint, test, build, Playwright E2E)
├── docs/                      # Technical documentation
│   ├── PRD.md                 # Product specifications, user journeys & feature requirements
│   ├── ARCHITECTURE.md        # Technical blueprint, DTO boundary rules, system diagrams
│   ├── AGENT_RULES.md         # Engineering guidelines, zero-leak rules, action checklist
│   ├── PROJECT_STRUCTURE.md   # Structural repository reference
│   ├── SETUP_KEYS.md          # Third-party integration & environment keys guide
│   └── ROADMAP.md             # Project phases, release gates, and fast-follow milestones
├── drizzle/                   # Drizzle ORM generated SQL migrations
├── e2e/                       # Playwright end-to-end test suites & support fixtures
├── messages/                  # Localization JSON catalogues (en.json, fr.json, ar.json)
├── public/                    # Service worker, offline fallback pages, manifest icons
├── scripts/                   # Administrative, seeding, and synchronization scripts
│   ├── seed-plan-limits.ts    # Seed tier quotas and limits table
│   ├── seed-ingredients.ts    # Seed normalized trilingual ingredient dictionary
│   ├── seed-catalog.ts        # Seed trilingual Discover recipe catalog
│   ├── set-admin.ts           # Administrative promotion utility
│   ├── stripe-sync.ts         # Stripe catalog synchronization
│   └── schedule-jobs.ts       # Upstash QStash cron schedule registration
├── src/
│   ├── app/                   # Next.js App Router (Routing only: thin page components)
│   │   ├── [locale]/
│   │   │   ├── (marketing)/   # Public routes: landing, discover, pricing, legal
│   │   │   ├── (auth)/        # Authentication routes: login, signup, verify, 2FA
│   │   │   └── (app)/         # Authenticated application shell: cook, planner, dishes, chat
│   │   └── api/               # External callbacks: auth, webhooks, jobs, cron, iCal
│   ├── server/                # Server-only execution layer ("server-only")
│   │   ├── actions/           # next-safe-action clients and action handlers
│   │   ├── features/          # Domain feature modules (service, queries, policy, schema, dto)
│   │   ├── db/                # Drizzle ORM database client & schema definitions
│   │   ├── auth/              # Better Auth configuration & permission helpers
│   │   ├── billing/           # Stripe SDK integration, webhook handlers, entitlement reconciler
│   │   ├── ai/                # Vercel AI SDK wrappers, prompt definitions, transcription
│   │   ├── storage/           # Cloudflare R2 client, sharp image processing, signed URLs
│   │   ├── outbox/            # Transactional outbox workers and job dispatchers
│   │   ├── realtime/          # Pusher Channels signing and event emission
│   │   └── security/          # Content Security Policy (CSP) builder & security headers
│   ├── components/            # Client and presentation UI components
│   │   ├── ui/                # Base design system primitives (shadcn/ui & Radix UI)
│   │   ├── app-shell/         # Application shell navigation, topbar, weather chip
│   │   ├── query/             # TanStack Query client cache over Server Actions
│   │   └── offline/           # IndexedDB offline synchronization utilities
│   ├── i18n/                  # next-intl routing and request configuration
│   └── proxy.ts               # Root request interceptor (locale routing, CSP nonce injection)
└── tests/                     # Unit, component, and integration test setup
```

---

## Contributing & Code of Conduct

Cooky follows rigorous engineering standards to maintain security, accessibility, and zero data leakage:

- **Zero-Leak Policy**: All backend mutations must execute via Server Actions. Never import internal server utilities into client components. Always return mapped DTOs.
- **Strict TypeScript**: Do not use `any` or loose type assertions. All Server Action inputs must be validated using Zod schemas.
- **Accessibility & i18n**: All UI components must meet WCAG 2.2 AA standards and provide full trilingual support (English, French, Arabic RTL). Never hard-code string literals.

For complete developer guidelines, please consult [AGENT_RULES.md](docs/AGENT_RULES.md) and [ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with care for home cooks worldwide. Cooky Engineering Team.</sub>
</div>
