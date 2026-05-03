#!/bin/bash
# Script de premier déploiement — à exécuter UNE SEULE FOIS sur le VPS
# Pré-requis : Node 22, pnpm, PM2, PostgreSQL, Nginx installés
set -e

APP_DIR="/var/www/cuistot_fute"
DB_USER="cuistot"
DB_NAME="cuistot"

echo "==> [1/7] Clonage du dépôt"
git clone https://github.com/biscoto85/cuistot_fute "$APP_DIR"
cd "$APP_DIR"

echo "==> [2/7] Installation des dépendances"
pnpm install --frozen-lockfile

echo "==> [3/7] Copie et édition du fichier .env"
cp apps/api/.env.example apps/api/.env
echo ""
echo "  *** STOP : éditez apps/api/.env avant de continuer ***"
echo "  Appuyez sur Entrée quand c'est fait..."
read -r

echo "==> [4/7] Création de la base de données PostgreSQL"
sudo -u postgres psql << SQL
CREATE USER $DB_USER WITH PASSWORD '$(grep DB_USER apps/api/.env | cut -d: -f3 | cut -d@ -f1)';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
SQL

echo "==> [5/7] Build et migrations"
pnpm --filter '@cuistot/shared' build
pnpm --filter '@cuistot/api' build
cd apps/api && pnpm db:migrate && cd ../..
pnpm --filter '@cuistot/web' build

echo "==> [6/7] Config Nginx"
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cuistotfute
sudo ln -sf /etc/nginx/sites-available/cuistotfute /etc/nginx/sites-enabled/cuistotfute
sudo nginx -t && sudo systemctl reload nginx

echo "==> [7/7] Démarrage PM2"
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "✓ Setup terminé !"
echo "  → Configurer le DNS : cuistotfute.mondomaine.fr → IP du VPS"
echo "  → HTTPS : certbot --nginx -d cuistotfute.mondomaine.fr"
