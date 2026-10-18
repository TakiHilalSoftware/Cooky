# Build Roadmap & Release Gates

Build phase by phase. A phase is **done** when its exit criteria pass in CI on a preview deployment. PRD §3.10 Experience Standards and AGENT_RULES apply to every phase; they are part of the definition of done, not a later polish pass.

## Phases

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| **0. Foundation** | pnpm + Next.js (pinned), TypeScript strict, Tailwind v4 + shadcn/ui, next-intl (EN/FR/AR + RTL), env validation, Drizzle + Neon, `server/` layout with `server-only`, eslint-plugin-boundaries, next-safe-action clients + error codes, pino + Sentry, proxy (locale + CSP nonce), security headers, Vitest/Playwright setup, GitHub Actions, Vercel previews with Neon branches, `CLAUDE.md`/`AGENTS.md` pointing to `docs/` | An empty app deploys to preview; CI green; a deliberate boundary violation fails lint; RTL layout renders |
| **1. Auth & Accounts** | Better Auth (email/password, verification, reset, Google/Apple, 2FA, passkeys, admin plugin), HIBP check, consents, devices list, outbox + QStash drain, Resend + React Email (3 locales), audit log, profiles, Settings (profile, appearance, security) | E2E: signup → verify → login → 2FA → revoke device → logout; Google sign-in links by email; securityheaders A+ |
| **2. Billing & Tries** | `plan_limits` seed, entitlements, Stripe Checkout/Portal/webhooks/reconcile, one trial per account, tries service (reserve/commit/refund), upgrade sheet, tries-left meter, Pricing page, Plan & billing settings | E2E: trial → paid, upgrade, cancel, failed payment → grace → Free; webhook replay idempotent; concurrent reservations never exceed the limit |
| **3. Recipes** | Dishes CRUD (servings, units, steps, dietary tags, nutrition), R2 + sharp uploads, ingredient dictionary + matching service + autocomplete, voice dictation, **import from link + share target**, favorites, collections, notes, ratings, backup export/import (jobs), Discover + catalog seed + filters, landing page, **starter-pack onboarding**, first-week checklist | Dish limit enforced per plan; photos re-encoded and signed; import works on 5 popular recipe sites; a new user finishes onboarding with dishes in the box |
| **4. Decide** | Weather service + **weather chip**, hemisphere seasons, **My kitchen (pantry)**, Cook ranking, Spin (sessions + tries), Assistant (threads, quick-start prompts, fallback provider), cooking mode | No third-party request visible in the browser; the same mood in the chip, Cook and Spin; tries meter correct across devices |
| **5. Plan & Shop** | Planner (drag & drop, meal slots, copy week, repeat), events & guests (Suggest, scaling, shop for menu), calendar (move/remove with undo), merged shopping list (units, aisles, manual items, staples skipped, share as text), **offline shopping list**, named timers (alarm, wake lock), global search + shortcuts, iCal feed (Pro), household list (Pro) | E2E: plan → shop for menu → merged totals correct → check off offline → sync on reconnect; logout wipes offline data |
| **6. Social** | Friends (requests, limits, decline cooldown), block/unblock, groups, sharing policy, friend profile + copy, chat (ids-only realtime, typing, receipts, dish cards, edit/delete, archive), profile popup, unread dot, push + preferences, reports | Two-user E2E chat; the Pusher console shows ids only; a blocked user can't find, add or message; an unfriended chat is read-only |
| **7. Admin & Ops** | Admin panel (overview with MRR, catalog with translation flags, users incl. suspend/comp, content moderation, reports, feedback, audit viewer), scheduled jobs (cleanup, purge, retention, reconcile), data export job + signed download, account deletion with grace period | Purge removes DB rows + R2 objects + the Stripe customer; export links expire; every admin action appears in the audit log |
| **8. Launch** | Load test, legal pages, store-style screenshots/OG images, go-live checklist (`SETUP_KEYS.md`), *(optional)* the legacy data import (`LEGACY_IMPORT.md`) | All release gates below pass |

## Fast-follow (within ~4–8 weeks after launch)

| Feature | Why after launch |
| --- | --- |
| Public share links with OG previews (growth loop) | Needs reports and moderation live first |
| Friends' activity feed + "Popular with your friends" | Needs enough friend density to feel alive |
| Smart reminders (plan tomorrow, event shopping, rate yesterday's cook, prep) | Needs production outbox/cron telemetry |
| AI "Fill my week" (Plus+) | Tune after real tries data |
| **Ramadan mode** (suhoor/iftar slots, iftar countdown, collections, prompts) | **Must ship before Ramadan 2027 (begins ≈ early February 2027; confirm the exact date).** Missing it means waiting a year, so schedule it backwards from that date |

## Out of scope (for now)
Group chats, photo messages, recipe import from a photo, automatic nutrition estimates, native mobile apps (store billing would need separate handling), offline access to anything beyond the active shopping list and today's recipe.

## Release Gates (all must pass)
- [ ] **Zero-leak:** a review of every page's RSC payload and the client bundles finds no secrets, no other users' emails, no storage keys, no limit constants and no raw rows
- [ ] **Authorization:** integration tests prove every action rejects unauthenticated, banned and non-owner callers
- [ ] **Billing:** Stripe test-mode E2E for trial → paid, upgrade, downgrade (read-only over the limit), failed payment → grace → Free, cancel; the nightly reconcile finds no drift
- [ ] **Tries:** a concurrency test (parallel requests can't exceed a limit), refund on provider failure, reset at period boundaries
- [ ] **Offline:** the shopping list works in airplane mode, syncs on reconnect, and is wiped on logout/revoke
- [ ] **Reliability:** outbox retries and dead-letter alerts work; a database restore was rehearsed
- [ ] **Performance:** p95 action < 500 ms (excluding AI), TTFB < 800 ms, LCP < 2.5 s on a mid-range phone, ≤ 150 KB JS per route
- [ ] **Accessibility & i18n:** axe checks pass; every string exists in EN/FR/AR; RTL screenshots reviewed for every page
- [ ] **UX standards:** every page has a skeleton, an empty state with a next step, a recoverable error state, and undo for reversible deletes
- [ ] **Legal:** terms, privacy (processor list), refund policy and imprint published; Stripe Tax configured
