#!/bin/bash
# Script de premier déploiement — à exécuter UNE SEULE FOIS sur le VPS
# Pré-requis : Node 22, pnpm, PM2, PostgreSQL, Nginx installés
set -e

APP_DIR="/var/www/cuistot_fute"
DOMAIN="cuistotfute.fr"

# ── 1. Clonage ────────────────────────────────────────────────────────────────
echo "==> [1/7] Clonage du dépôt dans $APP_DIR"
git clone https://github.com/biscoto85/cuistot_fute "$APP_DIR"
cd "$APP_DIR"

# ── 2. Dépendances ────────────────────────────────────────────────────────────
echo "==> [2/7] Installation des dépendances"
pnpm install --frozen-lockfile

# ── 3. .env ───────────────────────────────────────────────────────────────────
echo "==> [3/7] Configuration du fichier .env"
cp apps/api/.env.example apps/api/.env
echo ""
echo "  *** STOP : éditez maintenant apps/api/.env avec les valeurs réelles ***"
echo "  Variables à remplir :"
echo "    DATABASE_URL=postgresql://cuistot:MOTDEPASSE@localhost:5432/cuistot"
echo "    JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
echo "    ANTHROPIC_API_KEY=sk-ant-..."
echo "    CORS_ORIGIN=https://$DOMAIN"
echo "    NODE_ENV=production"
echo ""
echo "  Appuyez sur Entrée quand apps/api/.env est rempli..."
read -r

# ── 4. PostgreSQL ─────────────────────────────────────────────────────────────
echo "==> [4/7] Création de la base PostgreSQL"
echo "  Entrez le mot de passe choisi pour l'utilisateur 'cuistot' :"
read -rs DB_PASSWORD
echo ""
sudo -u postgres psql << SQL
CREATE USER cuistot WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE cuistot OWNER cuistot;
GRANT ALL PRIVILEGES ON DATABASE cuistot TO cuistot;
SQL
echo "  DB créée. Mettez à jour DATABASE_URL dans .env si ce n'est pas fait."
echo "  Appuyez sur Entrée pour continuer..."
read -r

# ── 5. Build + migrations ─────────────────────────────────────────────────────
echo "==> [5/7] Build et migrations"
pnpm --filter '@cuistot/shared' build
pnpm --filter '@cuistot/api' build
pnpm --filter '@cuistot/api' db:migrate
pnpm --filter '@cuistot/web' build

# ── 6. Nginx ──────────────────────────────────────────────────────────────────
echo "==> [6/7] Configuration Nginx"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cuistotfute
sudo ln -sf /etc/nginx/sites-available/cuistotfute /etc/nginx/sites-enabled/cuistotfute
sudo nginx -t
sudo systemctl reload nginx
echo "  Nginx rechargé. Site disponible sur http://$DOMAIN"

# ── 7. PM2 ───────────────────────────────────────────────────────────────────
echo "==> [7/7] Démarrage PM2"
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✓ Setup terminé !"
echo ""
echo "  Étapes suivantes :"
echo "  1. SSL : sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  2. Cron backup : crontab -e  (voir deploy/crontab.example)"
echo "  3. Vérifier : pm2 status && pm2 logs cuistot-api --lines 20"
