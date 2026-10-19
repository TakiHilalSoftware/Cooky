CREATE TYPE "public"."spin_mode" AS ENUM('random', 'ingredients');--> statement-breakpoint
CREATE TABLE "spin_sessions" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"picked_dish_ids" uuid[] DEFAULT '{}' NOT NULL,
	"mode" "spin_mode" DEFAULT 'random' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spin_sessions_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "spin_sessions" ADD CONSTRAINT "spin_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;