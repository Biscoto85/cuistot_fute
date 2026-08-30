CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
INSERT INTO "app_settings" ("key", "value") VALUES ('llm_model', 'claude-sonnet-4-6'), ('prompt_version', 'v5');
