# Legacy Data Import (optional)

> **Only needed if users must be migrated from the earlier Cooky app.** That app is a separate system with its own PostgreSQL database. Nothing in this project depends on it, so skip this doc if you're launching fresh. It's built as a one-off script in Phase 8 (`scripts/import-legacy.ts`), reading from `LEGACY_DATABASE_URL` (read-only credentials).

## Source schema (legacy database, 24 tables)
`users`, `profiles`, `password_reset_tokens`, `email_verification_tokens`, `push_subscriptions`, `dishes`, `dish_ingredients`, `dish_ratings`, `suggested_dishes`, `suggested_dish_ingredients`, `cook_log`, `events`, `event_dishes`, `shopping_lists`, `friend_requests`, `friendships`, `user_blocks`, `friend_groups`, `friend_group_members`, `dish_groups`, `conversations`, `messages`, `conversation_reads`, `feedback` (+ its own `schema_migrations`).

Notable legacy formats:
- Passwords are **bcrypt** hashes.
- Images (`profiles.avatar_data_url`, `dishes.image_url`) are mostly **base64 data URLs** stored in the row.
- `dish_ingredients.quantity` is free text.
- `dishes.instructions` is a single text block.
- `shopping_lists` has one row per dish, with `checked_ingredients` jsonb.

## Mapping

| Legacy table | Destination |
| --- | --- |
| `users` | Better Auth `user` + a credential `account` carrying the bcrypt hash. Configure password verification to accept bcrypt, and rehash on the next successful login. `is_admin` → admin role. `email_verified_at` → verified flag. Lockout/session-version columns are dropped |
| `profiles` | `profiles`: `display_name`; `avatar_data_url` → decode → sharp → R2 → `avatar_key`; `bg_color` → `accent`; `preferred_language` → `locale`; `city` geocoded → `lat/lon/hemisphere/timezone`; notification flags carried over; `intro_seen` carried over |
| `password_reset_tokens`, `email_verification_tokens` | Not imported (they expire) |
| `push_subscriptions` | Not imported (push needs a session; users re-enable it after their first login) |
| `dishes` | `dishes`: `image_url` data URL → R2 `image_key` (http URLs re-fetched into R2); `instructions` split into `dish_steps` by line/sentence; `servings` null; `dietary_tags` empty; `suggested_dish_id` → `catalog_dish_id` (remapped); `copied_from_dish_id` remapped |
| `dish_ingredients` | `dish_ingredients`: free-text `quantity` parsed into `amount` + `unit` when unambiguous ("500g", "2 tbsp"), otherwise kept in `note`; names linked to the `ingredients` dictionary via the matching service |
| `dish_ratings` | `dish_ratings` |
| `suggested_dishes`, `suggested_dish_ingredients` | Not copied. The catalog is re-seeded and saved-copy links remapped by matching name + country |
| `cook_log` | `cook_log` (`meal_slot` null, `source` = `cook`) |
| `events`, `event_dishes` | Same |
| `shopping_lists` | One active `shopping_lists` row per user, with merged `shopping_items` from each dish's ingredients; checked state carried over |
| `friend_requests`, `friendships`, `user_blocks` | Same (keep canonical a < b ordering) |
| `friend_groups`, `friend_group_members`, `dish_groups` | Same |
| `conversations`, `messages`, `conversation_reads` | Same (soft-deleted messages stay soft-deleted) |
| `feedback` | Same |

## Procedure
1. Dry run into a Neon branch, then compare row counts per table and spot-check 20 users end to end.
2. Freeze the legacy app (read-only banner), run the final import, and verify the counts.
3. Email users in their language: "Cooky has a new home; log in with your usual email and password."
4. Keep the legacy database read-only for 90 days, then archive it.
