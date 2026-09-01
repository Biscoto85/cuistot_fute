-- Script de rattrapage idempotent : applique toutes les colonnes/tables des
-- migrations 0002 → 0006, sans erreur si certaines sont déjà en place.
-- Usage : psql -U cuistot cuistotfutes < deploy/catchup-migrations.sql

-- 0002 — complexité culinaire
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS cooking_complexity text NOT NULL DEFAULT 'intermediate';

-- 0003 — stock garde-manger, régime, niveau de menu
DO $$ BEGIN
  CREATE TYPE pantry_stock_status AS ENUM ('ok', 'bas', 'vide');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE pantry_targets ADD COLUMN IF NOT EXISTS stock_status pantry_stock_status NOT NULL DEFAULT 'ok';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS diet_regime text NOT NULL DEFAULT 'flexitarien';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS fish_ok boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS menu_tier text NOT NULL DEFAULT 'normal';

-- 0004 — âges des enfants
ALTER TABLE households ADD COLUMN IF NOT EXISTS children_ages jsonb NOT NULL DEFAULT '[]';

-- 0005 — crédits
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 2;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS regen_count integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 0006 — réglages admin
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
INSERT INTO app_settings (key, value)
  VALUES ('llm_model', 'claude-sonnet-4-6'), ('prompt_version', 'v5')
  ON CONFLICT (key) DO NOTHING;

-- Promotion admin (sans effet si le compte n'existe pas encore)
UPDATE users SET is_admin = true WHERE email = 'francois-xavier.hoffner@cecodev.fr';
