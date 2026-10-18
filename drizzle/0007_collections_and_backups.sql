CREATE TYPE "public"."backup_import_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
ALTER TYPE "public"."outbox_kind" ADD VALUE 'backup_import';--> statement-breakpoint
CREATE TABLE "backup_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "backup_import_status" DEFAULT 'queued' NOT NULL,
	"dishes" jsonb,
	"total" integer NOT NULL,
	"imported" integer DEFAULT 0 NOT NULL,
	"skipped" jsonb,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_dishes" (
	"collection_id" uuid NOT NULL,
	"dish_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_dishes_collection_id_dish_id_pk" PRIMARY KEY("collection_id","dish_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backup_imports" ADD CONSTRAINT "backup_imports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_dishes" ADD CONSTRAINT "collection_dishes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_dishes" ADD CONSTRAINT "collection_dishes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_imports_user_id_idx" ON "backup_imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "collection_dishes_dish_id_idx" ON "collection_dishes" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_name_uniq" ON "collections" USING btree ("user_id",lower("name")) WHERE "collections"."deleted_at" is null;