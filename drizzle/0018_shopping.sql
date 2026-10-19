CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"ingredient_id" uuid,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"unit_family" text NOT NULL,
	"amount" numeric(12, 3),
	"unit" "unit",
	"aisle" "aisle" DEFAULT 'other' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"source_dish_ids" uuid[] DEFAULT '{}' NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_lists_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_items_merge_idx" ON "shopping_items" USING btree ("list_id","key","unit_family");