ALTER TABLE "users" ADD COLUMN "credits" integer NOT NULL DEFAULT 2;
ALTER TABLE "users" ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false;
ALTER TABLE "weekly_plans" ADD COLUMN "regen_count" integer NOT NULL DEFAULT 0;
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
UPDATE "users" SET "is_admin" = true WHERE "email" = 'francois-xavier.hoffner@cecodev.fr';
