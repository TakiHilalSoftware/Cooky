# Product Requirements Document (PRD): Cooky

> The engineering bar is **production-ready, server-authoritative and subscription-based** from day one. Prices and limits marked *(proposal)* are starting points to validate.

## 1. Product Vision & Goals

### 1.1 Core Proposition
**Cooky** is a multilingual (English, French, Arabic) home-cooking companion, delivered as an installable web app (PWA). It answers *"what do I cook today?"* from the user's own recipe box, using what's in their kitchen, the season and the local weather. From there it carries the user through planning the week, hosting guests, shopping, timing the cook and remembering what was made. A social layer lets friends share recipes, chat and rate each other's dishes. A subscription unlocks higher limits and AI-powered help.

### 1.2 Core Value Proposition
- **Decide in seconds:** Cook ranks your dishes by missing ingredients, Spin picks one for you, and the AI Assistant suggests dishes in plain conversation.
- **Your recipes, organized:** A personal recipe box with ingredients, steps, photo, course, difficulty, seasons, servings, dietary tags and nutrition, plus import from any recipe link, collections, backup and restore.
- **Plan → shop → cook → remember:** Weekly planner, guest events with multi-course menus, a merged shopping list that works offline, cooking mode with timers, and a cooking calendar, all connected.
- **Cook with friends:** Share dishes with all friends or private groups, copy and rate friends' recipes, and chat in real time with dish cards.
- **Made for its audience:** Three languages with full RTL Arabic, Ramadan mode, dark mode, an accent color you choose, voice input, and installation on any device.
- **Trustworthy by design:** All logic and data access run on the server. The browser only displays results and sends user intents. No keys, rules or other people's data ever reach it.

### 1.3 Success Metrics (KPIs)
- **Weekly Active Cooks:** Share of users who log ≥1 cooked dish per week.
- **Activation:** Share of new users who add or save ≥3 dishes and log a first cook within 7 days.
- **Free → Paid Conversion:** Paid subscriptions within 30 days of signup; trial → paid conversion.
- **Quota Pressure:** Share of free users who hit a try limit (AI, voice, import), the signal for paywall placement.
- **Retention & Churn:** D7/D30 retention; monthly paid churn; involuntary churn (failed payments).
- **Suggestion Acceptance:** Assistant/Spin picks that become a calendar entry, shopping item or saved dish.
- **Social Reach & Growth:** Share of users with ≥1 friend; shares and messages per active user; signups from public share links.
- **Reliability:** Error-free sessions ≥ 99.5%; p95 server action latency < 500 ms (excluding AI).

---

## 2. User Personas & User Journeys

### 2.1 Persona 1: The Weeknight Home Cook (Amina, 34). Free tier
- **Pain Points:** Comes home tired, stares at the fridge, repeats the same three dishes.
- **Goals:** Pick a realistic dish from what's at home in under a minute.
- **Workflow:** Opens Cook → her kitchen is already remembered, so she adds *chicken* → the server ranks "Chicken tagine (ready to cook)" first, with cozy dishes up because the weather chip says 🌧️ → **Start Cooking** opens cooking mode with step timers → **Log it for today** → the next morning, a reminder asks her to rate it. She uses 3 of her 10 free Assistant tries this month, hits the limit at the end of the month, and upgrades to Plus.

### 2.2 Persona 2: The Host & Planner (Karim, 41). Plus
- **Pain Points:** Hosts family dinners, juggles courses, forgets ingredients.
- **Goals:** Plan the week and a guest menu, then shop once.
- **Workflow:** Planner → **Copy last week**, then swaps two meals → creates *"Friday dinner, 8 guests"* → fills courses and uses an AI **Suggest** for the dessert → recipes scale to 8 servings → **Shop for this menu** → one merged list ("Onions ×5"), staples skipped → ticks items off at the store with no signal (offline list), and it syncs when he's back online.

### 2.3 Persona 3: The Social Foodie (Lina, 24). Pro
- **Pain Points:** Recipes scattered across screenshots and links; wants new ideas and to swap with friends.
- **Goals:** Discover cuisines, share with a close circle, see what friends love.
- **Workflow:** Taps **Share → Cooky** on a recipe website → the dish form comes back pre-filled → saves it into her "Weekend baking" collection → shares her "Baklava" with the *Family* group and sends a **public link** to a friend who isn't on Cooky yet → the friend signs up with Google, copies it, cooks it and rates the original.

---

## 3. Comprehensive Feature Specifications

Every feature below is computed on the server. The UI only renders what the server returns and sends the user's intent back (see §4 and `ARCHITECTURE.md`).

### 3.0 Public Landing, Pricing & App Shell
- **Landing page** (public, statically rendered per locale):
  - Top bar: logo, language switcher, theme toggle, and log in/sign up or account status. When signed in, also the messages icon with its unread dot.
  - Headline and tagline ("Plan, cook, and shop without the guesswork").
  - 8 feature cards: Dishes, Cook, Spin, Calendar, Planner, Timer, Shopping, Assistant. Each goes to the page, or to signup when signed out.
  - Carousel of Discover dishes (10 random for signed-in users, with "saved" state; a curated preview for visitors).
  - Pricing section, footer (explore links, account links, contact, legal).
- **Pricing page:** Plan comparison table (§3.7), monthly/yearly toggle, FAQ, "Start free trial".
- **Not-found page:** Any unknown URL under a locale renders a branded, translated 404 with "Back to home". Unknown locales redirect to the default one.
- **App shell (signed in):**
  - **Desktop:** sidebar with Cook, Dishes, Discover, Spin, Assistant, Calendar, Planner, Timer, Shopping, Friends, Messages, Settings, plus Admin for admins and the profile/logout area.
  - **Phone:** a bottom navigation (Cook, Dishes, Planner, Shopping, More).
  - **Top bar:** page title, global search, **weather chip**, messages icon with an **unread dot**, help icon (reopens the page's "How it works"), language switcher, theme toggle.
  - Friends shows a **new-request badge**, cleared when the user opens Friends.
- **Weather chip** (all plans): a small animated badge in the top bar that shows how it *feels* outside right now. The server returns only the condition and numbers, and the chip picks an icon, subtle animation and tint:

  | Condition | Shown when | Feel / tooltip |
  | --- | --- | --- |
  | ☀️ Sunny | clear sky, day | "Sunny, 26°C · light dishes first" |
  | 🌙 Clear night | clear sky, night | "Clear night, 14°C" |
  | ⛅ Cloudy | partly/overcast | "Cloudy, 18°C" |
  | 🌧️ Rainy | drizzle/rain/showers | "Rainy, 12°C · cozy dishes first" |
  | ⛈️ Stormy | thunderstorm | "Stormy · perfect for a slow stew" |
  | ❄️ Snowy | snow | "Snowy, -2°C · warm and hearty" |
  | 🌫️ Foggy | fog | "Foggy, 9°C" |
  | 💨 Windy | wind ≥ 40 km/h (overrides clear/cloudy) | "Windy, 15°C" |
  | 🔥 Hot / 🥶 Freezing | ≥ 30 °C / ≤ 0 °C (accent on top of the condition) | "Hot · something fresh" / "Freezing · soup weather" |

  Tapping it opens a popover with temperature, feels-like, wind and rain, the iftar countdown when Ramadan mode is on, and a **"Cook for this weather"** link to Cook. With no city or location set, it shows "Set your city" and links to Settings. It respects `prefers-reduced-motion` (static icon) and has an accessible label. The value is cached server-side for 30 minutes.

### 3.1 Accounts, Onboarding & Profile
- **Sign in with Google / Apple:** shown above the email form. Accounts are linked by verified email, and a password is optional for social accounts.
- **Email + password:** 8–128 characters, checked against known breached passwords. Email verification is required before the first login (24 h link), and password reset is by email (1 h link). Optional **2FA (TOTP)** and **passkeys**.
- **Consent:** the signup form states "By signing up, you agree to the Terms of Service and Privacy Policy" with links. The accepted document version and time are stored.
- **Sessions:** server-side, in the database. A **Signed-in devices** list lets the user revoke one device or all of them. **Revoking a session also removes that device's push subscription and wipes its offline data.**
- **Change password:** current password + new password twice, rate-limited (5 per 15 min). It signs out every *other* device and keeps this one signed in.
- **Abuse protection:** progressive lockout after failed logins, rate limits on every auth endpoint, signup throttled per IP.
- **Onboarding (starter pack):**
  1. Language.
  2. City, or "use my location".
  3. Dietary preferences.
  4. Pick favorites from a visual grid of Discover dishes (≥3, saved to My Dishes).
  5. Tick common staples you always have.

  Cook, Spin and the Planner are useful from minute one. After onboarding, each page shows a short "How it works" intro once.
- **First-week checklist:** a dismissible card that tracks "Add 3 dishes · Tick your kitchen · Log a cook · Plan a day · Add a friend". Each step links to the right place.
- **Settings:**
  - **Profile:** display name, cropped profile photo.
  - **Appearance:** accent palette (Default + peach, mint, sky, lavender, sand, rose), light/dark/system theme, text size (S/M/L/XL).
  - **Cooking:** units (metric/imperial), Ramadan mode.
  - **Notifications:** preferences and reminder times, push per device.
  - **App:** offline shopping list toggle, install card.
  - **Security:** password, 2FA, passkeys, devices.
  - Also: blocked people, feedback, **Plan & billing**, **Your data**.
- **Your data:** full export (prepared by a background job and delivered as a short-lived download link), recipe backup, account deletion (re-authentication required; the subscription is cancelled first; a 7-day grace period before purge, cancellable by logging in).

### 3.2 My Dishes (Recipe Box)
- **Dish fields:** name, ingredients (name, amount, unit, note), difficulty (easy/medium/hard), course (appetizer/main/side/dessert/drinks), seasons, servings, dietary tags/allergens, ordered steps (optional timer per step), photo, nutrition per serving (kcal, protein, carbs, fat; optional).
- **Scaling:** view or shop a recipe for N servings. Structured amounts scale and are converted to the user's units; free-text notes stay as written.
- **Input helpers:**
  - Ingredient autocomplete (Tab/Enter to accept).
  - **Voice dictation** *(tries)*, e.g. "2 potatoes, 500 g of chicken and salt" becomes ingredient rows.
  - Voice shows a clear message for each failure: microphone blocked (how to allow it), insecure connection, no microphone, offline, recording too long, nothing heard, service unavailable. Typing always remains possible.
- **Import from a link** *(tries)*: paste a URL, or **Share → Cooky** from the browser or another app (PWA share target). The server reads the page's recipe data (with an AI fallback) and pre-fills the dish form for review. Nothing is saved until the user confirms, and the source is credited.
- **Favorites & collections:** star dishes and group them into named collections ("Quick weeknights", "Ramadan", "Kids"). Collections work as filters in Cook, Spin and the Planner library.
- **Notes:** a private "my notes" field on any dish ("less salt next time").
- **Visibility:** Only me / Friends / Groups (selected private friend groups).
- **Dish page:**
  - Full recipe, scaled view, nutrition with macro split.
  - Ratings and reviews (1–5★ + text). Rating is only possible after cooking, and a copy of a friend's dish rates the original.
  - Share options.
- **Cooking mode:** one step per screen, large text (XL by default), inline step timers, the screen kept awake, swipe or tap to advance. Available offline for today's dish.
- **Backup:** export/import a versioned Cooky file (≤500 dishes, ≤5 MB). Import is validated and processed in the background, with a result summary ("42 imported · 3 skipped").
- **Ingredient matching** (one server service, used by autocomplete, Cook, Discover, Spin, the Assistant and shopping merge):
  - The dictionary is seeded with everyday staples in EN/FR/AR, including regional Arabic variants (Maghreb and Mashreq), plus catalog and user ingredients.
  - Comparison is normalized: case, accents and Arabic letter forms are folded, and the Arabic article "ال" is ignored.
  - Words match by prefix, which covers plurals and short forms ("potato" ↔ "Potatoes", "pomme" ↔ "pommes"). Words under 3 letters must match exactly, so "oil" never matches "boiled".
  - A wanted ingredient matches a line when **all** its words match ("chicken" ↔ "Chicken breast").
  - Multi-ingredient filters try **all** first, then fall back to **any** and say so ("No dish uses all of these…").

### 3.3 Discover (Recipe Catalog)
- An admin-curated catalog (12+ countries, fully translated EN/FR/AR).
- Filters: country, course, dietary tag. Featured carousel; seasonal and holiday collections (Ramadan iftar, Eid sweets, summer salads); "Popular with your friends"; "ingredients you have" matching.
- **Save to my dishes** keeps a link to the catalog entry, so names and quantities follow the user's language until they edit the copy.

### 3.4 Deciding What to Cook
- **My kitchen (pantry):**
  - The ingredients a user has are remembered.
  - **Staples** (salt, oil, spices…) are marked "always have", so they're never counted as missing or added to shopping.
  - **Done shopping** offers to add the bought items to the kitchen.
  - Logging a cook can optionally mark used items as finished.
- **Cook:**
  - Starts from My kitchen, and the user can add or remove ingredients.
  - Ranking: fewest missing ingredients first, then weather fit, dietary fit, and how recently the dish was cooked.
  - Each card shows "Ready to cook" or "2 missing: …".
  - Actions: Start cooking (cooking mode), Log it for today, Rate it, Spin instead.
- **Spin:**
  - A playful wheel weighted to the current season and weather, in *Random* or *With my ingredients* mode (up to 10, all→any fallback).
  - No repeats within a day, and spins per day depend on the plan.
  - After a spin: add to calendar or not now. Out of ideas → "Ask the assistant".
- **AI Assistant** *(tries)*:
  - Opens with an intro and **quick-start prompts** ("What can I make with chicken and potatoes?", "Something quick for tonight", "A light dinner idea", "Ideas for my next event").
  - It knows the user's dishes, a Discover shortlist, the season, weather, recent cooking, upcoming events, kitchen and dietary tags.
  - It returns a short reply and 1–3 dish cards from real candidates only. It never invents dishes, and it answers in the user's language.
  - Actions on a card: open, cook today, add to shopping, save the Discover recipe.
  - Conversations are saved (history across devices, deletable). **New chat** and a disclaimer ("AI can make mistakes") are always visible. Typed or by voice.
- **Weather:**
  - The city is saved in the profile, or the user grants browser location once.
  - One weather source feeds the chip, Cook, Spin and the Assistant, so they always agree.
  - Seasons follow the user's hemisphere.
  - Mood for ranking: rainy, stormy, snowy, freezing or below 15 °C → **cozy** (fall/winter dishes first); above 24 °C and dry → **light** (spring/summer dishes first); otherwise the calendar season.

### 3.5 Planning & Cooking Tools
- **Weekly Planner:**
  - Drag and drop dishes onto days, or tap a dish then a day's "+". Planned meals can be moved between days.
  - Optional meal slots (breakfast/lunch/dinner, plus suhoor/iftar in Ramadan mode).
  - **Copy last week**, **repeat a meal**, and *(Plus+, uses an Assistant try)* **Fill my week**, where the AI drafts the empty slots and the user accepts or edits.
  - Everything is synced with the Calendar.
- **Events & Guests:**
  - Name, date, guests (1–500) and one dish per course.
  - **Suggest** per course (AI on paid plans, rule-based on Free).
  - Recipes scale to the guest count, and **Shop for this menu** adds the whole menu.
- **Calendar:**
  - A month view of cooked and planned meals plus events. Tap a day to see them.
  - Each entry can be **moved to another date** or **removed** (with undo). An event opens in the Planner.
  - *(Pro)* A private **iCal feed** (secret, revocable URL) for Google/Apple Calendar.
- **Shopping:**
  - **One merged list:** the same ingredient across dishes is combined, with amounts summed when units allow and converted to the user's units.
  - Items are grouped by aisle. Manual items ("paper towels") can be added, and staples are skipped.
  - Progress ("12 of 18"), **Done shopping**, clear list.
  - **Share as text** (WhatsApp/SMS/copy).
  - *(Pro)* A live list shared with household members.
  - **Works offline** (see §4).
- **Kitchen Timer:**
  - Countdowns (quick presets or custom, up to 24 h) and a stopwatch with laps. Several **named timers** at once ("Rice", "Oven").
  - When a countdown ends: a "Time's up!" banner with a **beep and vibration**, plus a push notification if Cooky is in the background.
  - The screen stays awake while a timer runs, and timers survive a page reload.
- **Global Search:**
  - Searches pages, my dishes, friends' dishes, Discover, friends and events (from 2 characters, typo-tolerant), grouped by type.
  - Shortcuts: **Ctrl/⌘+K** or **/** to open, **↑/↓** to move, **Enter** to open, **Esc** to close.

### 3.6 Social: Friends, Groups, Messages
- **Friends:**
  - Search by display name, or by **exact** email only, so other users' emails are never revealed.
  - Requests are limited to 20/hour. A declined request stays "Requested" for the sender, who can't re-ask for 30 days.
  - Accept/decline. Unfriend (shared dishes and groups end, and the chat becomes read-only). **Block** (silent; they can't find, add or message you; unblock in Settings), also directly from a request.
- **Friend profile:** their shared dishes (paginated), **Copy to my dishes**, Message, Unfriend/Block, Report.
- **Groups:** private friend lists (Family, Work…) used for dish visibility. Members are never told, and only current friends count.
- **Messages:**
  - Real-time 1:1 chat with typing indicator and sent/delivered/seen.
  - Attach your shareable dishes as cards. Edit or delete your own messages.
  - Archive or delete a conversation (each side independently). A chat becomes read-only after an unfriend.
  - Tap the friend's name for a **profile popup** (avatar, shared dishes, link to the profile).
  - The top-bar icon shows an **unread dot**. Older messages load 50 at a time.
- **Friends' activity** (opt-in): a light feed ("Lina cooked Baklava ★5") and "Popular with your friends" in Discover. Only dishes already shared with the viewer appear. Sharing your own activity is **off by default**.
- **Public share link:** the owner can create a revocable link to a read-only dish page with a rich preview (Open Graph) for WhatsApp/Instagram, and a **"Save to Cooky"** call to action. It's the main growth loop, off by default per dish.
- **Safety:** report a user, dish, review or message. Admins can suspend accounts.
- **Notifications:**
  - In-app toasts and Web Push for messages, friend requests, accepted requests, reminders, timer alerts and billing events.
  - Each type can be switched off, and notifications are localized per device.
  - If the app is open and focused, the system notification is suppressed in favor of the in-app toast.

### 3.7 Subscription & Paywall

Billing runs through **Stripe** (hosted Checkout + Customer Portal). Plans are derived **only** from Stripe webhook data stored in the database, never from the client. All prices and limits are *(proposal)*.

| | **Free** | **Plus** (€3.99/mo · €35.99/yr) | **Pro** (€7.99/mo · €69.99/yr) |
| --- | --- | --- | --- |
| Dishes in recipe box | 50 | 500 | 2,000 |
| Discover, Cook, Planner, Calendar, Timer, Search, Cooking mode | ✓ | ✓ | ✓ |
| Recipe scaling, merged + offline shopping list | ✓ | ✓ | ✓ |
| Favorites, notes, My kitchen | ✓ | ✓ | ✓ |
| Collections | 3 | Unlimited | Unlimited |
| Spins per day | 3 | 20 | Unlimited* |
| AI Assistant questions | **10 tries / month** | 150 / month | 600 / month* |
| Voice dictation | **10 tries / month** | 100 / month | 400 / month* |
| Import recipe from a link | **5 tries / month** | 50 / month | 200 / month* |
| AI "Suggest" for event courses, "Fill my week" | Rule-based Suggest only | ✓ (uses Assistant tries) | ✓ |
| Upcoming events | 2 | Unlimited | Unlimited |
| Friend groups | 2 | 10 | 50 |
| Public share links, named timers | ✓ | ✓ | ✓ |
| Backup import | — | ✓ | ✓ |
| Shared household shopping list | — | — | ✓ |
| iCal calendar feed | — | — | ✓ |
| Trial | — | 7 days, **once per account** | 7 days, **once per account** |

\* *Fair use: Unlimited and high caps still have per-minute burst limits.*

- **User-based tries:** each metered feature has a counter per user and period (the calendar month in UTC for Free, the billing period for paid plans). The server **reserves** a try before calling the AI or provider and **gives it back** if the call fails. The UI shows "7 of 10 tries left" from server data and can't bypass the counter.
- **Upgrade paths:** an upgrade sheet appears where a limit is hit (the 11th question, the 51st dish, the 3rd event). There's also the Pricing page and Settings → Plan & billing.
- **Downgrades:** nothing is deleted. Content over the limit becomes read-only (viewable and cookable, but you can't add more) until the user is back under the limit or upgrades.
- **Lifecycle emails and push:** trial ends in 2 days · payment failed (7-day grace, then Free) · cancellation confirmed (plan stays until the period ends) · receipt.
- **Taxes & invoices:** Stripe Tax, Stripe-hosted invoices; prices are shown in the user's currency.

### 3.8 Administration & Operations
- **Admin panel** (the role is granted by CLI or by another admin, and every action is audit-logged):
  - **Overview:** users (+ new this week), MRR, active subscriptions and trials, suggested dishes, user recipes (+ shared), written reviews, try usage by feature.
  - **Catalog:**
    - Search by name/country.
    - Create, edit or delete dishes with EN/FR/AR names, ingredients, quantities and steps. Missing translations are flagged.
    - Each dish shows how many users saved it. Deleting a dish keeps users' copies.
  - **Users:**
    - Search by name/email, paginated.
    - Actions: mark verified, unlock, sign out everywhere, suspend/unsuspend, make/revoke admin, grant a complimentary plan, delete.
    - Admins can't demote or delete themselves.
  - **Content:** recent reviews → delete (removes the rating too); recently shared dishes → make private (owner keeps it) or delete; reports queue → resolve or dismiss with an action.
  - **Feedback:** bug, feature or other messages from Settings (5/hour per user, account, language and browser attached). Filter by status/type, resolve, reopen, delete. Admins get a push alert on new feedback.
  - **Audit log viewer.**
- **Audit log:** every admin action and sensitive user action (login, password change, 2FA change, plan change, deletion).

### 3.9 Engagement & Ramadan Mode
- **Smart reminders** (push/email, each opt-in, quiet hours respected, localized):
  - "Plan tomorrow's dinner?" at an evening hour the user picks.
  - The day before an event: "Shop for Friday dinner".
  - The morning after a cook: "How was the tagine? Rate it".
  - Prep reminders for planned dishes with a "prep the day before" step.
- **Ramadan mode:**
  - Switched on in Settings or suggested near the date, never on by default.
  - Brings suhoor/iftar meal slots, an iftar countdown in the weather popover (computed for the user's city), Ramadan collections in Discover, and assistant prompts tuned to iftar and suhoor.
  - It's a strong differentiator for the Arabic- and French-speaking audience.

### 3.10 Experience Standards (apply to every screen)
- **Instant feel:** optimistic updates for ticks, checks, favorites and moves, with the server result winning. Every route has a skeleton loading state, and likely next pages are prefetched.
- **Undo over confirm:** reversible deletes (a shopping item, planned meal, calendar entry or message) happen immediately and show an **Undo** toast for 6 s. Confirm dialogs only for irreversible or wide-impact actions (delete account, group or event).
- **Every empty state has a next step:** an illustration, one sentence and a primary action ("No dishes yet → Add a dish / Browse Discover").
- **Every error state is recoverable:** a friendly message, **Try again**, and what still works offline. Never raw error text.
- **Paywall respect:** reading and cooking are never blocked; limits only stop *adding* or *AI* actions. "Tries left" stays low-key until ≤3 remain. The upgrade sheet shows the gain and the price, and closes in one tap.
- **Mobile-first ergonomics:** thumb-reachable primary actions, bottom navigation, haptic feedback on key actions where supported, 44 px touch targets, no horizontal scroll at 320 px.
- **Readability & motion:** text size setting, AA contrast in every palette and theme, `prefers-reduced-motion` respected (weather chip, carousels, spin wheel).
- **Consistency:** one toast system, one dialog/sheet component, one date format per locale, and the same wording for the same action in all three languages.
- **Performance budget:** ≤ 150 KB JS per route (gzip), LCP < 2.5 s on a mid-range phone over 4G, images in modern formats at the displayed size.

---

## 4. Non-Functional Requirements
- **Server-authoritative:** reads happen in Server Components through a server-only data layer. Writes go through Server Actions that enforce auth → authorization → validation → plan/tries → rate limit → transaction → audit. Client components receive minimal data objects (DTOs) only, never raw rows, other users' emails, internal flags, keys or business rules.
- **No third-party calls from the browser:** weather, AI, storage, payments and email all go through the server. The only exception is the realtime socket (public key, private channels, ids-only events). The Content Security Policy enforces this.
- **Security:** nonce-based CSP, strict headers, HSTS, origin checks on actions, env validated at boot, secrets only in server env, EXIF/GPS stripped from uploads, private storage with short-lived signed URLs, SSRF-guarded link import, dependency scanning.
- **Privacy & Compliance:** GDPR export and deletion, data minimization, essential cookies only (no banner unless analytics cookies are added), processors listed in the privacy policy, retention (assistant history 90 days, deleted accounts purged after 7 days).
- **Reliability:** idempotent webhooks, side effects via a transactional outbox with retries, scheduled cleanups, database backups with point-in-time recovery, graceful degradation when an optional provider is down.
- **Observability:** error tracking (server + client), structured logs with request ids, uptime checks, alerts on webhook failures, job dead letters and try anomalies.
- **Internationalization:** every screen, email, push and catalog entry in EN/FR/AR, with RTL Arabic, localized dates, numbers and currency.
- **Offline & PWA:**
  - Installable, with an offline fallback page and a connection banner. Writes made while offline say so instead of failing silently.
  - Private data is never cached by the service worker, with **one deliberate exception**: the user's own **active shopping list** and **today's cooking-mode recipe** are stored on the device.
  - That exception is scoped to the signed-in user, on by default after install (switchable in Settings), and **wiped on logout or session revoke**.
  - Check-offs made offline are replayed through the normal Server Actions on reconnect, and the server result wins.
- **Performance:** p95 page TTFB < 800 ms, p95 action < 500 ms (excluding AI), paginated lists, indexed queries, images resized on upload.
- **Accessibility:** WCAG 2.2 AA: labels, keyboard navigation, focus management, contrast in every palette and theme.
- **Quality gates:** CI runs lint, typecheck, unit + integration tests, E2E smoke tests and a migration check on every PR. Preview deployments use isolated database branches.
