CREATE TYPE "public"."cook_source" AS ENUM('cook', 'spin', 'planner', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."meal_slot" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TABLE "cook_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dish_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_slot" "meal_slot",
	"source" "cook_source" DEFAULT 'cook' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_ratings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dish_id" uuid NOT NULL,
	"stars" smallint NOT NULL,
	"review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_log" ADD CONSTRAINT "cook_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_log" ADD CONSTRAINT "cook_log_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ratings" ADD CONSTRAINT "dish_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ratings" ADD CONSTRAINT "dish_ratings_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cook_log_user_date_idx" ON "cook_log" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "cook_log_dish_id_idx" ON "cook_log" USING btree ("dish_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dish_ratings_user_dish_idx" ON "dish_ratings" USING btree ("user_id","dish_id");--> statement-breakpoint
CREATE INDEX "dish_ratings_dish_id_idx" ON "dish_ratings" USING btree ("dish_id");