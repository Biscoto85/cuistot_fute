# Cuistot Futé

App web de planification hebdomadaire de repas avec génération LLM.

## Prérequis

- Node ≥ 22
- pnpm ≥ 10
- PostgreSQL (instance locale, base `cuistot`)

## Installation

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
# Remplir apps/api/.env avec les valeurs réelles
```

## Développement

```bash
pnpm dev          # démarre web (5174) + api (3003) en parallèle
```

## Structure

```
apps/web        — React + Vite + Tailwind   (port dev : 5174)
apps/api        — Express + Drizzle         (port : 3003)
packages/shared — types et schémas Zod partagés
tools/prompt-sandbox — CLI de test LLM (T13)
docs/spec.md    — spécification complète
```

## Déploiement

Voir `docs/spec.md` section 11 (T25 → T28) et `CLAUDE.md` section Deploy.
