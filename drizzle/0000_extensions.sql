-- Search extensions (docs/SETUP_KEYS.md §1): typo-tolerant, accent-insensitive search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
