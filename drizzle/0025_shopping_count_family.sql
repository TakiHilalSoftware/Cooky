-- A bare count ("2 carrots") is now a count of pieces: unit family "piece", not "none".
-- Existing lists are moved over, merging a "none" row into its "piece" twin.

-- Offline copies of the touched lists refresh (their version goes up).
UPDATE "shopping_lists" SET "version" = "version" + 1, "updated_at" = now()
WHERE "id" IN (SELECT DISTINCT "list_id" FROM "shopping_items" WHERE "unit_family" = 'none');
--> statement-breakpoint
UPDATE "shopping_items" AS p
SET "amount" = CASE WHEN p."amount" IS NULL THEN n."amount" WHEN n."amount" IS NULL THEN p."amount" ELSE p."amount" + n."amount" END,
    "unit" = COALESCE(p."unit", n."unit"),
    "source_dish_ids" = ARRAY(SELECT DISTINCT unnest(p."source_dish_ids" || n."source_dish_ids")),
    -- Still needed if either line was.
    "checked" = p."checked" AND n."checked",
    "updated_at" = now()
FROM "shopping_items" AS n
WHERE n."list_id" = p."list_id" AND n."key" = p."key" AND n."unit_family" = 'none' AND p."unit_family" = 'piece';
--> statement-breakpoint
DELETE FROM "shopping_items" AS n
USING "shopping_items" AS p
WHERE n."list_id" = p."list_id" AND n."key" = p."key" AND n."unit_family" = 'none' AND p."unit_family" = 'piece';
--> statement-breakpoint
UPDATE "shopping_items" SET "unit_family" = 'piece' WHERE "unit_family" = 'none';
