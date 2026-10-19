CREATE TYPE "public"."catalog_collection" AS ENUM('ramadan_iftar', 'eid_sweets', 'summer_salads', 'winter_comfort', 'quick');--> statement-breakpoint
CREATE TABLE "catalog_dishes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"country" text NOT NULL,
	"course" "course" NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"servings" integer NOT NULL,
	"seasons" "season"[] DEFAULT '{}' NOT NULL,
	"dietary_tags" "dietary_tag"[] DEFAULT '{}' NOT NULL,
	"collections" "catalog_collection"[] DEFAULT '{}' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text,
	"name_ar" text,
	"description_en" text NOT NULL,
	"description_fr" text,
	"description_ar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_dishes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "catalog_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"catalog_dish_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"amount" numeric(10, 3),
	"unit" "unit",
	"ingredient_id" uuid,
	"name_en" text NOT NULL,
	"name_fr" text,
	"name_ar" text,
	"note_en" text,
	"note_fr" text,
	"note_ar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"catalog_dish_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text_en" text NOT NULL,
	"text_fr" text,
	"text_ar" text,
	"timer_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "catalog_dish_id" uuid;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "follows_catalog" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_ingredients" ADD CONSTRAINT "catalog_ingredients_catalog_dish_id_catalog_dishes_id_fk" FOREIGN KEY ("catalog_dish_id") REFERENCES "public"."catalog_dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_ingredients" ADD CONSTRAINT "catalog_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_steps" ADD CONSTRAINT "catalog_steps_catalog_dish_id_catalog_dishes_id_fk" FOREIGN KEY ("catalog_dish_id") REFERENCES "public"."catalog_dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_dishes_country_idx" ON "catalog_dishes" USING btree ("country");--> statement-breakpoint
CREATE INDEX "catalog_dishes_course_idx" ON "catalog_dishes" USING btree ("course");--> statement-breakpoint
CREATE INDEX "catalog_ingredients_dish_idx" ON "catalog_ingredients" USING btree ("catalog_dish_id","position");--> statement-breakpoint
CREATE INDEX "catalog_ingredients_ingredient_idx" ON "catalog_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "catalog_steps_dish_idx" ON "catalog_steps" USING btree ("catalog_dish_id","position");--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_catalog_dish_id_catalog_dishes_id_fk" FOREIGN KEY ("catalog_dish_id") REFERENCES "public"."catalog_dishes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dishes_catalog_dish_id_idx" ON "dishes" USING btree ("catalog_dish_id");