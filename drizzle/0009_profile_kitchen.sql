ALTER TABLE "profiles" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "latitude" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "longitude" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "dietary_prefs" "dietary_tag"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "onboarded_at" timestamp with time zone;