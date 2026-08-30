CREATE TYPE "pantry_stock_status" AS ENUM ('ok', 'bas', 'vide');
ALTER TABLE "pantry_targets" ADD COLUMN "stock_status" "pantry_stock_status" NOT NULL DEFAULT 'ok';
ALTER TABLE "user_preferences" ADD COLUMN "diet_regime" text NOT NULL DEFAULT 'flexitarien';
ALTER TABLE "user_preferences" ADD COLUMN "fish_ok" boolean NOT NULL DEFAULT true;
ALTER TABLE "user_preferences" ADD COLUMN "menu_tier" text NOT NULL DEFAULT 'normal';
