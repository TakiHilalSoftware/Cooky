CREATE TABLE "dish_sources" (
	"dish_id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"site_name" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish_sources" ADD CONSTRAINT "dish_sources_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;