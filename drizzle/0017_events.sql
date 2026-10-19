CREATE TYPE "public"."event_course" AS ENUM('appetizer', 'main', 'side', 'dessert', 'drinks');--> statement-breakpoint
CREATE TABLE "event_dishes" (
	"event_id" uuid NOT NULL,
	"dish_id" uuid NOT NULL,
	"course" "event_course" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_dishes_event_id_course_pk" PRIMARY KEY("event_id","course")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"guests" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_dishes" ADD CONSTRAINT "event_dishes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dishes" ADD CONSTRAINT "event_dishes_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_dishes_dish_id_idx" ON "event_dishes" USING btree ("dish_id");--> statement-breakpoint
CREATE INDEX "events_user_date_idx" ON "events" USING btree ("user_id","date");