# Cooky Execution Guidelines (`AGENT_RULES.md`)

Read this before writing any code. Specs: `docs/README.md` (index), `PRD.md` (what), `ARCHITECTURE.md` (how), `PROJECT_STRUCTURE.md` (where), `ROADMAP.md` (order).

## 0. Before You Code
- **Check the docs of the installed version.** Libraries in this stack move fast: Next.js, Better Auth, next-safe-action, AI SDK, Tailwind v4, shadcn/ui, Drizzle, Serwist. Read the current docs (for Next.js, `node_modules/next/dist/docs/` when present, and heed deprecation notices) instead of relying on memory. If an API in these docs no longer exists, use the current equivalent and update the doc.
- **Stay in the roadmap.** Build the current phase. Don't scaffold future features, folders or tables early.
- **Don't swap stack choices silently.** If a chosen library is wrong for a task, say why and propose the change before switching.

## 1. Core Principles
- **Server-authoritative, always.** If code decides *anything* (ranking, pick, limit, price, permission, validity), it lives in `src/server/`. Client code renders and sends intents.
- **Strict TypeScript.** No `any`, no `as` casts across the boundary, no `@ts-ignore`. DTO types come from `server/**/dto.ts`, and input types from Zod (`z.infer`).
- **Thin routing.** Pages in `src/app/**` await a query and render a component. No SQL, business logic or third-party calls in pages or layouts.
- **One door for writes.** Every mutation is a Server Action in `src/server/actions/*`, built from a next-safe-action client (`publicAction`, `userAction`, `adminAction`, `meteredAction(feature)`). Never write a bare `"use server"` function. Route handlers exist only for Better Auth, webhooks, Pusher auth, jobs/cron, iCal, the share target and signed downloads.
- **Feature folders.** `server/features/<feature>/{service,queries,policy,schema,dto}.ts` and `components/<feature>/`. Keep files small and single-purpose.
- **Readable code.** Comments explain *why*, not what. Consistent naming. No dead code or commented-out code.

## 2. Zero-Leak Rules (non-negotiable)
- **`import "server-only"`** at the top of every `src/server/` file except action entry files and `dto.ts` type exports.
- **DTOs only.** Never pass a DB row, a user/session object or a Stripe object to a client component. Map it in `dto.ts` to the minimum fields the UI renders: no other users' emails, no internal flags, no storage keys (send signed URLs), no limits.
- **Taint** user/session rows and tokens (`experimental_taintObjectReference`, `experimental_taintUniqueValue`) where they are loaded.
- **Secrets stay on the server.** All env access goes through `src/server/env.ts` (`@t3-oss/env-nextjs`). The client schema is the full public allow-list: Pusher key/cluster, VAPID public key, Sentry DSN, app URL. Adding a public variable needs a written reason in the PR.
- **No browser calls to third parties.** Weather, AI, storage, Stripe and email go through actions. The only exception is the Pusher socket. If a new origin is truly needed client-side, add it to the CSP and justify it.
- **No client `fetch` for data.** Data arrives as Server Component props or Server Action return values. Uploads send `FormData` to an action.
- **Realtime events carry ids only.** The client then refreshes through the server.
- **Errors:** return a typed error code. Never return `error.message`, stack traces or provider responses. Log those to Sentry with PII scrubbed.
- **Browser storage** is for pure UI conveniences only: theme, text size, collapsed panels, unsent drafts, running timers. Never use it for state that grants or limits anything (spins, tries, trials, pantry, assistant history). **The single sanctioned exception** is `components/offline/`: the user's own active shopping list and today's recipe in IndexedDB, keyed by user id, wiped on logout or session revoke, with writes queued and replayed through actions.

## 3. Action Checklist (every action)
1. **Client:** pick the right next-safe-action client. It resolves the session from the DB and rejects banned or pending-deletion users.
2. **Schema:** a Zod `inputSchema` for **all** input: trim, cap lengths and counts, uuid checks, enums.
3. **Policy:** ownership/sharing check via `features/<x>/policy.ts`. Never trust a client-provided id without it.
4. **Plan & tries:** `meteredAction(feature)` reserves a try, and the handler's outcome commits or refunds it. Plan limits come from `quota.limitFor()`, never hard-coded.
5. **Rate limit:** an Upstash burst limit keyed by user (and IP for public actions).
6. **Transaction:** multi-step writes in `db.transaction`, with row or advisory locks wherever a count limit must hold under concurrency.
7. **Audit + outbox:** written **inside the same transaction**. Never call email, push, Pusher or Stripe side effects directly from an action body.
8. **Revalidate & return:** `revalidateTag`/`revalidatePath` for affected views, then return the DTO.

## 4. Data & Billing Standards
- **The Drizzle schema is the source of truth.** Change it, run `pnpm db:generate`, review the SQL, and include backfills in the same migration. Never edit a merged migration. Index every FK and every hot filter. Better Auth tables are generated by its CLI.
- **Entitlements come only from the DB** (Stripe webhooks + nightly reconcile + admin comps). Never read plan state from query strings, cookies or the client.
- **Limits live in `plan_limits`** (seeded). Never write `if (plan === "pro") max = 2000`.
- **Webhooks:** verify the signature, dedupe on the event id, finish fast, and push heavy work to the outbox.
- **Uploads:** check magic bytes, re-encode with sharp, strip metadata, store privately in R2, and serve only signed URLs after a policy check.
- **Outbound fetches from user input** (link import) must go through `server/importer` (SSRF guard).
- **Privacy by default:** new user-owned tables cascade on purge, appear in the data export, and get a retention rule if they hold logs or AI content.

## 5. i18n, Styling & UX
- **No hard-coded text.** Every string, including emails and push, goes in `messages/en.json`, `fr.json` **and** `ar.json`. Arabic uses simple Modern Standard Arabic with feminine forms. Layouts must work RTL (logical `ms-/me-/ps-/pe-`, `start/end`, mirrored icons where directional).
- **shadcn/ui + Tailwind v4 tokens.** No one-off colors. Check light and dark mode, every accent, text sizes S–XL, and 320 px width.
- **Follow PRD §3.10 Experience Standards on every screen:**
  - optimistic UI with the server winning
  - undo toasts instead of confirms for reversible deletes
  - a skeleton `loading.tsx`
  - an empty state with a next step
  - a recoverable error state
  - 44 px touch targets
- **Client validation is only a hint.** Reuse the action's Zod schema for instant feedback; the server result always wins.
- **Paywall UX:** tries and limits are rendered from server values. On `quota_exceeded` / `plan_required`, open the upgrade sheet; never dead-end the user.
- **Offline:** use the connectivity hook to block writes with the feature's offline message (except the offline shopping list, which queues).
- **Accessibility:** WCAG 2.2 AA, labelled controls, focus management in dialogs and sheets, keyboard paths, `prefers-reduced-motion`.

## 6. Testing & Workflow
- **Unit** (`*.test.ts` next to `service.ts`): pure rules such as ranking, matching, scaling, unit conversion, merging, tries math and weather mapping.
- **Component** (Testing Library): interactive pieces with logic-free props (forms, planner drag/drop, offline queue).
- **Integration** (`tests/integration/`): every action against a real Postgres. Cover unauthenticated, banned and non-owner callers, quota exhaustion and refunds, concurrency limits, and webhook idempotency. External services are mocked with MSW.
- **E2E** (`e2e/`): the critical journeys listed in ROADMAP release gates.
- **Before handing off:** `pnpm check` (lint + typecheck + test). CI also runs integration, build and E2E.
- **Dev server:** the user may already be running `pnpm dev` on port 3000. Check before starting another server or running a build (they share `.next`).
- **Work in small steps:** one issue or feature slice at a time, then hand it off for testing. **Never commit or push unless asked.**
