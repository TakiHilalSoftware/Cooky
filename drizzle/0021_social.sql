CREATE TYPE "public"."dish_visibility" AS ENUM('private', 'friends', 'groups');--> statement-breakpoint
CREATE TYPE "public"."friend_request_status" AS ENUM('pending', 'declined');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'inappropriate', 'impersonation', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('user', 'dish', 'message', 'review');--> statement-breakpoint
ALTER TYPE "public"."outbox_kind" ADD VALUE 'push';--> statement-breakpoint
ALTER TYPE "public"."outbox_kind" ADD VALUE 'pusher';--> statement-breakpoint
CREATE TABLE "conversation_reads" (
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_reads_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"archived_by_a" boolean DEFAULT false NOT NULL,
	"archived_by_b" boolean DEFAULT false NOT NULL,
	"cleared_at_a" timestamp with time zone,
	"cleared_at_b" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_ordered" CHECK ("conversations"."user_a_id" < "conversations"."user_b_id")
);
--> statement-breakpoint
CREATE TABLE "dish_groups" (
	"dish_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dish_groups_dish_id_group_id_pk" PRIMARY KEY("dish_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "friend_group_members" (
	"group_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_group_members_group_id_member_id_pk" PRIMARY KEY("group_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "friend_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_a_id_user_b_id_pk" PRIMARY KEY("user_a_id","user_b_id"),
	CONSTRAINT "friendships_ordered" CHECK ("friendships"."user_a_id" < "friendships"."user_b_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"dish_id" uuid,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"target_type" "report_target" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notifications_off" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "checklist_dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "friends_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "visibility" "dish_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "dishes" ADD COLUMN "copied_from_dish_id" uuid;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_a_id_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_b_id_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_groups" ADD CONSTRAINT "dish_groups_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_groups" ADD CONSTRAINT "dish_groups_group_id_friend_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."friend_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_group_id_friend_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."friend_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_a_id_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_b_id_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_reads_user_idx" ON "conversation_reads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_idx" ON "conversations" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "conversations_user_b_idx" ON "conversations" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "dish_groups_group_idx" ON "dish_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "friend_group_members_member_idx" ON "friend_group_members" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_groups_owner_name_idx" ON "friend_groups" USING btree ("owner_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_pair_idx" ON "friend_requests" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_to_idx" ON "friend_requests" USING btree ("to_user_id","status");--> statement-breakpoint
CREATE INDEX "friend_requests_from_sent_idx" ON "friend_requests" USING btree ("from_user_id","sent_at");--> statement-breakpoint
CREATE INDEX "friendships_user_b_idx" ON "friendships" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_dish_idx" ON "messages" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_session_idx" ON "push_subscriptions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_resolved_by_idx" ON "reports" USING btree ("resolved_by");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_uniq" ON "reports" USING btree ("reporter_id","target_type","target_id") WHERE "reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_copied_from_dish_id_dishes_id_fk" FOREIGN KEY ("copied_from_dish_id") REFERENCES "public"."dishes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_display_name_trgm_idx" ON "profiles" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dishes_copied_from_idx" ON "dishes" USING btree ("copied_from_dish_id");--> statement-breakpoint
CREATE INDEX "dishes_user_visibility_idx" ON "dishes" USING btree ("user_id","visibility");