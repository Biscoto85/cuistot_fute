# Cuistot Futé

App web de planification hebdomadaire de repas avec génération LLM (Claude Sonnet 4.6).
Conçue pour réduire la charge mentale alimentaire via un mode batch-cooking dominical.

## Fonctionnalités

- Génération d'un plan semaine complet (repas midi/soir + batch du dimanche) via IA
- Contexte personnel : foyer, préférences, envies ponctuelles, garde-manger
- Liste de courses structurée par lieu d'achat, avec suivi de progression
- Vue quotidienne "Aujourd'hui" avec les assemblages du jour
- Notation des repas pour améliorer les générations suivantes
- Export RGPD et suppression de compte

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Base de données | PostgreSQL, Drizzle ORM |
| Validation | Zod (schémas partagés) |
| LLM | API Anthropic, `claude-sonnet-4-6` |
| Auth | JWT cookie httpOnly, argon2 |
| Package manager | pnpm workspaces |
| Logging | Pino (JSON structuré) |

## Prérequis

- Node ≥ 22
- pnpm ≥ 10
- PostgreSQL (instance locale ou distante)
- Clé API Anthropic (`sk-ant-...`)

## Installation et développement

```bash
# Dépendances
pnpm install

# Variables d'environnement
cp apps/api/.env.example apps/api/.env
# Éditer apps/api/.env : DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, CORS_ORIGIN

# Base de données
pnpm --filter @cuistot/api db:migrate

# Démarrer les serveurs de dev (web :5174 + api :3003)
pnpm dev
```

L'interface est accessible sur `http://localhost:5174`.

## Structure du monorepo

```
cuistot_fute/
├── apps/
│   ├── web/              # React + Vite (port dev : 5174)
│   └── api/              # Express + Drizzle (port : 3003)
├── packages/
│   └── shared/           # Types et schémas Zod partagés web ↔ api
├── tools/
│   └── prompt-sandbox/   # CLI de test du prompt LLM sans DB
├── deploy/
│   ├── nginx.conf        # Config Nginx (reverse proxy + SPA)
│   ├── deploy.sh         # Script de déploiement (git pull → build → reload)
│   ├── setup.sh          # Installation initiale sur VPS
│   ├── backup.sh         # Backup PostgreSQL quotidien
│   ├── healthcheck.sh    # Vérification de santé + redémarrage auto
│   └── crontab.example   # Entrées cron pour backup et healthcheck
├── docs/
│   └── spec.md           # Spécification produit complète
└── ecosystem.config.js   # Config PM2
```

## Variables d'environnement

### `apps/api/.env`

| Variable | Description | Exemple |
|---|---|---|
| `NODE_ENV` | Environnement | `development` |
| `PORT` | Port Express | `3003` |
| `DATABASE_URL` | Connexion PostgreSQL | `postgresql://cuistot:mdp@localhost:5432/cuistot` |
| `JWT_SECRET` | Secret JWT (≥ 32 chars) | `openssl rand -base64 48` |
| `ANTHROPIC_API_KEY` | Clé API Anthropic | `sk-ant-...` |
| `CORS_ORIGIN` | Origin exacte du frontend | `http://localhost:5174` |

## Commandes utiles

```bash
# Développement
pnpm dev                                    # web + api en parallèle
pnpm --filter @cuistot/api db:migrate       # appliquer les migrations
pnpm --filter @cuistot/api db:generate      # générer une migration après modif schema
pnpm --filter @cuistot/api db:studio        # Drizzle Studio (UI DB)

# Build
pnpm --filter @cuistot/shared build
pnpm --filter @cuistot/api build
pnpm --filter @cuistot/web build

# Sandbox LLM (test du prompt sans DB)
pnpm --filter prompt-sandbox start generate --user fixtures/user-fx.json --week 2025-01-06
pnpm --filter prompt-sandbox start show-prompt --user fixtures/user-fx.json

# TypeScript
pnpm --filter @cuistot/api tsc --noEmit
pnpm --filter @cuistot/web tsc --noEmit
```

## Déploiement sur VPS

### Première installation

```bash
# Sur le VPS, copier et exécuter le script de setup
scp deploy/setup.sh user@vps:~/
ssh user@vps
chmod +x setup.sh && ./setup.sh

# Configurer Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cuistotfute
sudo ln -s /etc/nginx/sites-available/cuistotfute /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Créer /var/www/cuistot_fute/.env avec les variables de production
# Puis effectuer un premier déploiement
cd /var/www/cuistot_fute && bash deploy/deploy.sh
```

### Déploiements suivants

```bash
ssh user@vps "cd /var/www/cuistot_fute && bash deploy/deploy.sh"
```

Le script effectue : `git pull` → `pnpm install` → build shared → build api → build web → `pm2 reload`.

### Automatisation (cron)

```bash
# Ajouter au crontab via : crontab -e
# Voir deploy/crontab.example pour les entrées complètes
# Backup DB quotidien à 3h05, healthcheck toutes les 5 min
```

### PM2

```bash
pm2 status                    # état de l'instance cuistot-api
pm2 logs cuistot-api          # logs temps réel
pm2 restart cuistot-api       # redémarrage manuel
```

## Ports (cohérence VPS)

| Service | Port |
|---|---|
| PairsForm API | 3001 |
| Partiprism API | 3002 |
| **Cuistot Futé API** | **3003** |
| Partiprism dev frontend | 5173 |
| **Cuistot Futé dev frontend** | **5174** |

## RGPD

- `GET /api/users/me/export` — téléchargement JSON de toutes les données du compte
- `DELETE /api/users/me` — suppression du compte avec confirmation de mot de passe (cascade sur toutes les tables)
- Aucun tracking tiers, aucune analytics externe

## Spec produit

La spécification complète (fonctionnalités, modèle de données, format LLM, découpage en tâches) est dans `docs/spec.md`.
