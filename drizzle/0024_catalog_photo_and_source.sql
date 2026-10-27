ALTER TABLE "catalog_dishes" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "catalog_dishes" ADD COLUMN "source" text DEFAULT 'curated' NOT NULL;--> statement-breakpoint
CREATE INDEX "catalog_dishes_source_idx" ON "catalog_dishes" USING btree ("source");