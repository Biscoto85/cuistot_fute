#!/bin/bash
# Script de déploiement Cuistot Futé — à exécuter sur le VPS depuis /var/www/cuistot_fute
set -e

echo "==> [1/6] Pull des dernières modifications"
git pull origin main

echo "==> [2/6] Installation des dépendances"
pnpm install --frozen-lockfile

echo "==> [3/6] Build du package shared"
pnpm --filter @cuistot/shared build

echo "==> [4/6] Build de l'API"
pnpm --filter @cuistot/api build

echo "==> [5/6] Build du frontend"
pnpm --filter @cuistot/web build

echo "==> [6/6] Redémarrage PM2"
pm2 reload cuistot-api --update-env

echo "✓ Déploiement terminé"
pm2 status cuistot-api
