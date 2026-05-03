# CLAUDE.md — Cuistot Futé

Instructions persistantes pour Claude Code travaillant sur ce projet.

## Contexte projet

**Cuistot Futé** est une web app personnelle (multi-utilisateur) de planification
hebdomadaire de repas avec génération LLM. Elle aide à réduire la charge mentale
alimentaire, le gaspillage et les dépenses, en s'appuyant sur un mode batch-cooking
dominical et des bases modulaires réutilisables sur la semaine.

**Spec produit complète** : voir `docs/spec.md`. À lire intégralement à chaque
nouvelle session avant d'attaquer une tâche.

**Utilisateur principal** : François-Xavier (FX), seul puis utilisé en multi-user
(notamment par son frère). Le projet est hébergé sur le même VPS que PairsForm.

## Stack imposée (ne pas dévier sans demander)

- **Frontend** : React + TypeScript + Vite + Tailwind
- **Backend** : Node.js + Express + TypeScript
- **DB** : PostgreSQL avec Drizzle ORM
- **Validation** : Zod, schémas partagés frontend/backend
- **LLM** : API Anthropic, modèle Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Auth** : Email + password, JWT cookie httpOnly, hash argon2
- **Package manager** : pnpm (workspaces)
- **Déploiement** : PM2 + Nginx (cohérent avec PairsForm)
- **Logging** : Pino (JSON structuré)

Cohérence avec PairsForm : conserver les mêmes conventions de stack et de
déploiement quand elles existent là-bas, pour mutualiser les compétences ops.

## Structure monorepo

```
cuistot_fute/
├── apps/
│   ├── web/             # React + Vite
│   └── api/             # Express + Drizzle
├── packages/
│   └── shared/          # types et zod schemas partagés
├── tools/
│   └── prompt-sandbox/  # CLI de test du prompt LLM
├── docs/
│   └── spec.md          # spec produit complète (référence)
├── CLAUDE.md            # ce fichier
├── README.md
└── package.json
```

## Méthode de travail

### Découpage en tâches
La spec définit 28 tâches (T1 → T28) découpées en 5 phases. Chaque tâche est
calibrée pour être faite en une session de 30-60 min sans timeout.

**Avant de commencer une tâche** : relire la section correspondante de `docs/spec.md`
et confirmer la compréhension avant d'écrire du code.

**À la fin de chaque tâche** :
- Commit propre avec message clair (ex: "T3: Auth complet (register, login, logout)")
- Vérifier que le code compile et que les tests existants passent
- Mettre à jour le README si pertinent
- Ne PAS enchaîner sur la tâche suivante sans validation explicite de FX

### Anti-timeout
Si une tâche se révèle plus large que prévu, **stopper et redécouper** plutôt que
de tout faire en une session. Mieux vaut 2 commits propres que 1 commit interrompu.

### Tests
Tests prioritaires (à NE PAS skipper) :
- Parsing et validation des réponses LLM
- Auth et isolation des données par `user_id`
- Endpoints critiques : generate, regenerate, finalize

Tests secondaires (acceptable de skipper en v1) : CRUD basique, UI components.

## Conventions de code

### TypeScript
- `strict: true` partout
- Pas de `any` sans justification commentée
- Types partagés dans `packages/shared`, jamais dupliqués

### Imports
- Imports absolus via alias (`@/...`) côté frontend et backend
- Imports de types avec `import type` quand applicable

### Schémas Zod
- Toujours dans `packages/shared`
- Source de vérité unique pour validation runtime ET inférence de type
- `z.infer<typeof MaSchema>` pour les types côté code

### Endpoints API
- REST classique, verbes HTTP standards
- Préfixe `/api/`
- Validation des inputs avec Zod en début de handler
- Erreurs renvoyées via le middleware central, format JSON cohérent
- `req.user.id` toujours utilisé pour scoper les requêtes DB (jamais d'`user_id` depuis le body)

### DB / Drizzle
- Migrations versionnées, jamais de modification directe en prod
- `created_at` / `updated_at` sur toutes les tables (sauf justification)
- FK avec `ON DELETE CASCADE` sur `user_id` pour permettre la suppression de
  compte (RGPD)

### Frontend
- Composants fonctionnels uniquement
- État serveur via TanStack Query (React Query)
- État local via `useState` / `useReducer`
- Pas de Redux ou autre state manager global en v1
- Tailwind pour le styling, pas de CSS modules
- Pas d'utilisation de `localStorage` / `sessionStorage` pour les données
  métier (uniquement pour préférences UI éphémères)

## Sécurité — règles non négociables

1. **Hashage des passwords** : argon2 uniquement (jamais md5/sha1/bcrypt)
2. **JWT secret** : variable d'environnement, jamais dans le code
3. **Cookies** : `httpOnly`, `secure` en prod, `sameSite=lax`
4. **Isolation user** : toute requête DB doit filtrer par `user_id` du JWT
5. **Pas de leak** : erreurs login génériques ("identifiants invalides")
6. **Rate limiting** : sur `/api/auth/login` au minimum
7. **CORS** : restrictif, origins en whitelist via env
8. **Variables sensibles** : `.env` jamais commit, `.env.example` documenté

## Prompt LLM

### Versioning
- Stocké dans `apps/api/src/llm/prompts/system-v{N}.ts`
- Constante `PROMPT_VERSION` exportée et loggée à chaque appel
- Toute modification = bump de version (changement non rétro-compatible
  uniquement) ou patch (modifs mineures)
- **Aucun prompt en DB** : versioning via le code uniquement

### Logging
- Chaque appel LLM est loggé en table `llm_logs` :
  prompt complet, réponse brute, parsing, latence, tokens, coût
- Sert au debug et au suivi de coûts

### Robustesse
- Validation Zod stricte de la réponse JSON
- 1 retry automatique avec message d'erreur si JSON invalide
- Pas de retry au-delà : échec → 500 + log complet

## RGPD lite

- `GET /api/users/me/export` : export complet des données du user en JSON
- `DELETE /api/users/me` : suppression compte avec cascade
- Page `/legal` avec mentions légales simples
- Pas de tracking tiers, pas d'analytics externes
- Hashage des passwords argon2

## Hors scope v1 (NE PAS implémenter)

- Inventaire vivant du congélateur
- Suggestion de réutilisation des restes
- Rejeu d'un plan passé en un clic
- Remplacement individuel d'un repas (la régénération avec feedback couvre)
- Suivi budget réel vs estimé
- OCR ticket de caisse
- PWA / notifications push
- Partage de plans entre users
- Mode "famille" multi-cuisinier sur même compte

Ces fonctionnalités sont actées pour v1.1+ après usage réel de v1. Si tu penses
qu'une de ces fonctionnalités est nécessaire pour faire tourner v1, **demander
avant** d'implémenter.

## Style éditorial (UI textes)

L'app s'adresse à un utilisateur adulte, autonome, plutôt expert en cuisine.

**Ton** : calme, expert, humain. Phrases courtes. Pas de marketing, pas
d'emoji partout, pas de "wow génial". On respecte l'intelligence du user.

**Exemples** :
- ✅ "Plan généré pour la semaine du 11 mai"
- ❌ "🎉 Yes ! Ton super plan est prêt 🚀"

- ✅ "Cuissons longues le dimanche, assemblages courts en semaine"
- ❌ "Découvre une approche révolutionnaire de la cuisine batch !"

## Git et workflow

- Branche principale : `main`
- Pas de PR pour FX en solo (commit direct sur `main`)
- Messages de commit en français OK, format : `T<num>: <description courte>`
- Tags Git pour les jalons importants (ex: `v0.1-deploy-perso`, `v1.0-multi-user`)

## Performance et coûts

- Coût LLM cible : ~5-15 centimes par génération de plan
- Latence cible génération : ≤ 60s (HTTP timeout serveur configuré ≥ 90s)
- Logger les coûts cumulés pour pouvoir alerter si dépassement budgétaire

## Deploy

- VPS partagé avec PairsForm et Partiprism
- DB PostgreSQL séparée (`cuistot` user et database), même instance locale port 5432
- **Port API Express : 3003** (PairsForm=3001, Partiprism=3002 → suite logique)
- **Port Vite dev : 5174** (Partiprism=5173)
- Sous-domaine séparé (`cuistotfute.<domaine>`)
- Instance PM2 nommée `cuistot-api` distincte
- Nginx : reverse proxy `cuistotfute.<domaine>` → `127.0.0.1:3003`
- `ecosystem.config.js` pointe vers `apps/api/dist/index.js`
- Backups DB quotidiens automatiques (cohérent avec PairsForm)

## Questions ouvertes / décisions à prendre

Quand un point n'est pas clair dans la spec, **demander à FX** plutôt que de
décider unilatéralement. Liste des sujets potentiellement ambigus :
- Limites précises du foyer (ex: comptage des invités fréquents ?)
- Granularité des saisons par région
- Comportement exact du mode "feedback-pending" sur l'accueil
- Stratégie de cache LLM (probablement aucune en v1)

## Pour démarrer

Si c'est ta première session sur ce projet :
1. Lire `docs/spec.md` intégralement
2. Confirmer la compréhension de la phase et de la tâche en cours
3. Vérifier que la stack et les conventions sont claires
4. Attaquer la tâche en respectant le découpage et les conventions

Bonne route. 🪶🥄
