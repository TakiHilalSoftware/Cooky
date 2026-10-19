CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ingredient_id" uuid,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"is_staple" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_items_user_key_idx" ON "pantry_items" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "pantry_items_ingredient_id_idx" ON "pantry_items" USING btree ("ingredient_id");