CREATE TYPE "public"."household_status" AS ENUM('pending', 'active');--> statement-breakpoint
CREATE TABLE "shopping_list_members" (
	"list_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "household_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_list_members_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "shopping_list_members" ADD CONSTRAINT "shopping_list_members_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_members" ADD CONSTRAINT "shopping_list_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_list_members_user_idx" ON "shopping_list_members" USING btree ("user_id");