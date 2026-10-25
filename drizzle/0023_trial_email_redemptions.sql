CREATE TABLE "trial_email_redemptions" (
	"email_key" text PRIMARY KEY NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
