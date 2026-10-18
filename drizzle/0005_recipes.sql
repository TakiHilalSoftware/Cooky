CREATE TYPE "public"."course" AS ENUM('appetizer', 'main', 'side', 'dessert', 'drinks');--> statement-breakpoint
CREATE TYPE "public"."dietary_tag" AS ENUM('vegetarian', 'vegan', 'pescatarian', 'halal', 'gluten_free', 'dairy_free', 'nut_free', 'egg_free');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."season" AS ENUM('spring', 'summer', 'autumn', 'winter');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('g', 'kg', 'ml', 'cl', 'l', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'piece', 'clove', 'pinch', 'bunch', 'slice', 'can');--> statement-breakpoint
CREATE TABLE "dish_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dish_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(10, 3),
	"unit" "unit",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_notes" (
	"dish_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dish_notes_dish_id_user_id_pk" PRIMARY KEY("dish_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dish_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dish_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"timer_seconds" integer,
	"prep_day_before" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"course" "course" NOT NULL,
	"seasons" "season"[] DEFAULT '{}' NOT NULL,
	"servings" integer NOT NULL,
	"dietary_tags" "dietary_tag"[] DEFAULT '{}' NOT NULL,
	"calories_kcal" integer,
	"protein_g" numeric(6, 1),
	"carbs_g" numeric(6, 1),
	"fat_g" numeric(6, 1),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"dish_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_dish_id_pk" PRIMARY KEY("user_id","dish_id")
);
--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_notes" ADD CONSTRAINT "dish_notes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_notes" ADD CONSTRAINT "dish_notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_steps" ADD CONSTRAINT "dish_steps_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dish_ingredients_dish_id_idx" ON "dish_ingredients" USING btree ("dish_id","position");--> statement-breakpoint
CREATE INDEX "dish_notes_user_id_idx" ON "dish_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dish_steps_dish_id_idx" ON "dish_steps" USING btree ("dish_id","position");--> statement-breakpoint
CREATE INDEX "dishes_user_id_idx" ON "dishes" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "dishes_name_trgm_idx" ON "dishes" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "favorites_dish_id_idx" ON "favorites" USING btree ("dish_id");