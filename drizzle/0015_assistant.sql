CREATE TYPE "public"."assistant_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" "assistant_role" NOT NULL,
	"content" text NOT NULL,
	"picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_id_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_messages_thread_idx" ON "assistant_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_threads_user_idx" ON "assistant_threads" USING btree ("user_id","updated_at");