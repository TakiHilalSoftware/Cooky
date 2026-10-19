CREATE TYPE "public"."data_export_status" AS ENUM('queued', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('bug', 'feature', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('open', 'resolved');--> statement-breakpoint
ALTER TYPE "public"."outbox_kind" ADD VALUE 'data_export';--> statement-breakpoint
ALTER TYPE "public"."outbox_kind" ADD VALUE 'stripe_cancel';--> statement-breakpoint
ALTER TYPE "public"."outbox_kind" ADD VALUE 'account_purge';--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "data_export_status" DEFAULT 'queued' NOT NULL,
	"object_key" text,
	"content" text,
	"size_bytes" integer,
	"expires_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text,
	"kind" "feedback_kind" NOT NULL,
	"message" text NOT NULL,
	"locale" text NOT NULL,
	"user_agent" text,
	"status" "feedback_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_exports_user_idx" ON "data_exports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "data_exports_expires_idx" ON "data_exports" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id","created_at");