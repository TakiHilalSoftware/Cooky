CREATE TABLE "planned_meals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dish_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_slot" "meal_slot",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planned_meals_user_date_idx" ON "planned_meals" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "planned_meals_dish_id_idx" ON "planned_meals" USING btree ("dish_id");