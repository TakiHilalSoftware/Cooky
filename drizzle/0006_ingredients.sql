CREATE TYPE "public"."aisle" AS ENUM('produce', 'meat_fish', 'dairy_eggs', 'bakery', 'grains_pasta', 'canned_jars', 'spices', 'oils_condiments', 'baking', 'frozen', 'drinks', 'other');--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"name_ar" text NOT NULL,
	"variants" text[] DEFAULT '{}' NOT NULL,
	"aisle" "aisle" NOT NULL,
	"default_unit" "unit",
	"is_common_staple" boolean DEFAULT false NOT NULL,
	"search" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD COLUMN "ingredient_id" uuid;--> statement-breakpoint
CREATE INDEX "ingredients_search_trgm_idx" ON "ingredients" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dish_ingredients_ingredient_id_idx" ON "dish_ingredients" USING btree ("ingredient_id");