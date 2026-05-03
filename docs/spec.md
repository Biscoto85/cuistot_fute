# Cuistot — Spécification technique v1.0 finale

App web de planification hebdomadaire de repas avec génération LLM, multi-utilisateur,
hébergée sur VPS personnel.

---

## 1. Vision produit

### 1.1 Problème résolu
- Réduire le gaspillage alimentaire et les dépenses excessives
- Réduire la charge mentale du "qu'est-ce qu'on mange cette semaine"
- Faciliter le batch-cooking dominical et les assemblages rapides en semaine
- Améliorer la qualité alimentaire (frais, saison, équilibre) sans rigidité
- S'adapter progressivement aux goûts de l'utilisateur

### 1.2 Boucle d'usage cible
1. **Vendredi/samedi matin** — saisie envies + contraintes, génération du plan (~2 min)
2. **Samedi** — courses (frais marché/Biocoop le jour J, réappro flexible Intermarché)
3. **Dimanche** — batch cooking selon les préparations modulaires
4. **Lun-Ven** — assemblages rapides selon le plan, sortie congel anticipée
5. **Samedi** — feedback rapide (notation des plats) avant nouveau cycle

### 1.3 Principes produit
- **Bases modulaires** : chaque cuisson dominicale alimente plusieurs repas sous des formes
  différentes (anti-monotonie)
- **L'app accompagne la semaine**, ne se contente pas de générer un plan
- **Personnalisation progressive** : le LLM apprend des goûts à travers les notations
- **Saisonnalité souple** : warning si limite de saison, pas de blocage
- **Charge mentale minimale** : pas d'inventaire vivant à maintenir

---

## 2. Stack technique

| Couche       | Choix                                                       |
| ------------ | ----------------------------------------------------------- |
| Frontend     | React + TypeScript + Vite + Tailwind                        |
| Backend      | Node.js + Express + TypeScript                              |
| DB           | PostgreSQL (instance VPS dédiée à `cuistot`)                |
| ORM          | Drizzle (cohérent avec PairsForm)                           |
| Validation   | Zod (schémas partagés frontend/backend)                     |
| LLM          | API Anthropic, modèle Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| Auth         | Email + password, JWT en cookie httpOnly, hash argon2       |
| Déploiement  | PM2 + Nginx reverse proxy (cohérent avec PairsForm)         |
| Logging      | Pino (structuré JSON)                                       |

### 2.1 Structure monorepo
```
cuistot/
├── apps/
│   ├── web/             # React + Vite
│   └── api/             # Express + Drizzle
├── packages/
│   └── shared/          # types et zod schemas partagés
├── tools/
│   └── prompt-sandbox/  # CLI de test du prompt LLM
├── package.json
└── README.md
```

---

## 3. Modèle de données

Toutes les tables ont systématiquement `created_at` et `updated_at` (sauf indication
contraire). Toutes les FK utilisent `ON DELETE CASCADE` quand il s'agit du `user_id`,
pour permettre la suppression de compte propre (RGPD).

### `users`
- `id` uuid PK
- `email` text unique not null
- `password_hash` text not null (argon2)
- `display_name` text not null
- `onboarding_completed` boolean default false
- `created_at`, `updated_at`

### `households` (1 ligne par user)
- `id` uuid PK
- `user_id` FK users unique
- `adults` int default 1 (≥ 13 ans)
- `children` int default 0 (< 13 ans)
- `description` text nullable (1 phrase libre intégrée à chaque prompt, ex: "couple
  + 1 ado gros mangeur, on mange peu de viande rouge")

### `user_locations`
- `id` uuid PK
- `user_id` FK users
- `name` text (ex: "Intermarché Senlis")
- `kind` enum : supermarche, bio, marche, primeur, boucherie, fromagerie, autre
- `notes` text (caractérisation du lieu : ce qu'on y trouve de bien)
- `priority` int (ordre d'affichage)

### `user_preferences` (1 ligne par user)
- `id` uuid PK
- `user_id` FK users unique
- `loves` jsonb (string[])
- `dislikes` jsonb (string[])
- `allergies` jsonb (string[]) — strict, jamais d'écart côté LLM
- `current_phase` text — ex: "moins de viande rouge", "phase sport"
- `dietary_targets` jsonb — ex: { "viande_rouge": "1/sem max", "poisson": "2/sem min" }
- `local_specialties` text — préférences durables par lieu : "huile olive 5L Biocoop",
  "miel Picardie", "fromages chèvre M. Dupuis"
- `notes` text — toute autre info utile au LLM

### `pantry_targets` (référentiel de cibles, pas inventaire vivant)
- `id` uuid PK
- `user_id` FK users
- `name` text (ex: "riz basmati")
- `category` enum : cereales, legumineuses, conserves, huiles_vinaigres, epices,
  condiments, boissons, sucres_farines, secs_divers, autre
- `target_quantity` numeric
- `unit` enum : kg, g, L, mL, pieces, boites, sachets
- `rotation_months` int (default 6)
- `last_purchased_at` date nullable
- `priority` enum : essentiel, secondaire
- `preferred_location_id` FK user_locations nullable
- `notes` text

### `weekly_plans`
- `id` uuid PK
- `user_id` FK users
- `week_start_date` date (lundi)
- `inputs_json` jsonb (snapshot des inputs)
- `output_json` jsonb (réponse LLM validée)
- `status` enum : draft, active, archived
- `notes` text (ajustements manuels, restes notés, etc.)
- `created_at`

### `meal_entries` (un repas individuel issu d'un plan, pour favoris/notation)
- `id` uuid PK
- `user_id` FK users
- `plan_id` FK weekly_plans
- `slot` text (ex: "lundi-soir", "mercredi-midi", "petit-dej-recurrent")
- `meal_label` text (ex: "Salade poulet noisettes")
- `meal_data_json` jsonb (assembly_note, ingrédients, etc.)
- `is_favorite` boolean default false
- `eaten_at` date nullable
- `created_at`

### `meal_ratings`
- `id` uuid PK
- `user_id` FK users
- `meal_entry_id` FK meal_entries nullable (peut être null si rating libre)
- `meal_label` text (dénormalisé pour requêtes faciles)
- `rating` smallint check in (-1, 0, 1)
- `comment` text nullable
- `rated_at` timestamptz default now()

### `llm_logs`
- `id` uuid PK
- `user_id` FK users nullable
- `kind` enum : generate_plan, regenerate_with_feedback, sandbox
- `prompt_version` text (hash ou version sémantique du template)
- `system_prompt` text
- `user_prompt` text
- `response_raw` text
- `response_parsed_json` jsonb nullable
- `validation_error` text nullable
- `latency_ms` int
- `tokens_input`, `tokens_output` int nullable
- `cost_estimate_eur` numeric nullable
- `created_at`

---

## 4. Auth et sécurité

### 4.1 Endpoints
- `POST /api/auth/register` { email, password, display_name } → crée user + déclenche onboarding
- `POST /api/auth/login` { email, password } → set cookie JWT httpOnly + retourne user
- `POST /api/auth/logout` → clear cookie
- `GET /api/auth/me` → retourne le user courant (utile au frontend)

### 4.2 Middleware
- `requireAuth` injecte `req.user` à partir du JWT
- Toutes les routes `/api/*` sauf `/api/auth/*` passent par `requireAuth`
- Toutes les requêtes DB filtrent systématiquement par `user_id` (jamais d'oubli)

### 4.3 Sécurité
- Hash argon2 (recommandé > bcrypt aujourd'hui)
- JWT signé avec secret long (`JWT_SECRET` env), expiration 30 jours
- Cookie : `httpOnly`, `secure` en prod, `sameSite=lax`
- CSRF : double-submit cookie ou header custom (vu que cookie httpOnly)
- Rate limit sur `/api/auth/login` (express-rate-limit, 5 tentatives / 15 min / IP)
- Pas de leak d'info sur les erreurs login ("identifiants invalides" générique)

### 4.4 RGPD lite
- `GET /api/users/me/export` → JSON complet de toutes les données du user
- `DELETE /api/users/me` → suppression compte + cascade (confirmation par mot de passe)
- Page `/legal` : mentions légales + politique de confidentialité simples
- Pas de tracking, pas de cookies tiers, pas d'analytics externes en v1

---

## 5. Onboarding (premier login)

Wizard en 5 étapes. Étapes 1-3 obligatoires, 4-5 skippables.

1. **Foyer** : adultes, enfants <13 ans, description libre
2. **Lieux de courses** : ajouter au moins 1 lieu. Champ "ville" pour suggestions
   pré-remplies via LLM ("propose-moi des lieux courants à Senlis"). User édite.
3. **Préférences alimentaires** : loves, dislikes (chips + ajout libre), allergies,
   phase actuelle
4. **Cibles garde-manger** : liste-type pré-cochée calibrée selon foyer + autonomie
   choisie (3/6/12 mois). User décoche / ajuste quantités.
5. **Spécialités locales / notes** : champ libre, vraiment skippable

`PUT /api/users/me/onboarding` marque comme terminé.

---

## 6. Génération de plan — flow complet

### 6.1 Inputs utilisateur (formulaire)

| Champ                              | Type                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Semaine cible                      | Date picker (défaut lundi prochain)                                           |
| Envies                             | Texte libre + mode "surprise"                                                 |
| Inclure petit-déj                  | Boolean (défaut true)                                                         |
| Nombre de préparations dimanche    | 2 / 3 / 4 (défaut 3)                                                          |
| Temps dispo dimanche               | Slider 1h / 1h30 / 2h / 2h30 / 3h / 3h30+                                     |
| Temps max assemblage en semaine    | Slider 10 / 15 / 20 / 30 min                                                  |
| Repas couverts                     | Grille 7×2 (midi/soir), checkboxes                                            |
| Budget cible                       | Champ optionnel € (défaut 80 ajustable)                                       |
| Note libre                         | "j'ai des invités jeudi soir", "semaine légère"                               |

### 6.2 Endpoint `POST /api/plans/generate`

```
1. Valider inputs (zod)
2. Charger contexte user :
   - users + households + user_preferences
   - user_locations (toutes)
   - pantry_targets (toutes, lecture seule pour info LLM)
   - 8 derniers weekly_plans (slots déjà servis → anti-répétition)
   - 30 derniers meal_ratings + meal_entries.is_favorite=true (kifs)
3. Construire prompt (système versionné + user) — voir section 7
4. Appeler API Anthropic
5. Parser réponse :
   - Si JSON valide selon schéma zod → continuer
   - Si invalide → 1 retry avec message d'erreur ("ta réponse précédente
     était invalide, voici l'erreur, réponds en JSON pur")
   - Si invalide après retry → 500, log complet en llm_logs
6. Persister :
   - weekly_plans (status=draft)
   - meal_entries (un par slot)
   - llm_logs
7. Retourner le plan complet au frontend
```

### 6.3 Endpoint `POST /api/plans/:id/regenerate`

Mêmes étapes que generate, avec en plus le contenu du plan précédent + un champ
`feedback` text ("trop de viande", "remplace le mardi soir", etc.). Le LLM est
invité à corriger en tenant compte du feedback. Le plan précédent est archivé
(status=archived) et le nouveau prend sa place.

### 6.4 Endpoint `POST /api/plans/:id/finalize`

Passe le plan de `draft` à `active`. Marque comme plan en cours, déclenche le
mode "courses à faire" sur l'écran d'accueil.

---

## 7. Prompt LLM

### 7.1 Versioning
- Stocké dans `apps/api/src/llm/prompts/system-v{N}.ts`
- Constante `PROMPT_VERSION` exportée, loggée dans chaque appel
- Modification du prompt = bump de version + redéploiement
- Aucun prompt en DB

### 7.2 Template système (v1)

```
Tu es l'assistant culinaire personnel de {{display_name}}, qui vit à {{ville}}.

CONTEXTE FOYER
{{adults}} adulte(s), {{children}} enfant(s) de moins de 13 ans.
{{household.description}}

PROFIL DE GOÛTS
Aime : {{preferences.loves}}
N'aime pas : {{preferences.dislikes}}
Allergies (STRICT, jamais d'écart) : {{preferences.allergies}}
Phase actuelle : {{preferences.current_phase}}
Cibles diététiques : {{preferences.dietary_targets}}
Spécialités locales : {{preferences.local_specialties}}
Notes : {{preferences.notes}}

KIFS DÉCLARÉS FAVORIS
{{favorite_meals}}  // meal_entries.is_favorite=true, max 20

PLATS RÉCEMMENT NOTÉS (pondérer en conséquence)
{{rated_meals_30last}}  // {label, rating, date} — booster +1, éviter -1

PLATS DES 8 DERNIÈRES SEMAINES (anti-répétition)
{{recent_meals}}

LIEUX DE COURSES
{{user_locations}}  // pour chacun : nom, kind, notes

GARDE-MANGER (cibles, à supposer disponible)
{{pantry_targets}}  // pour chacun : nom, quantité cible, rotation, dernier achat
Note : pas d'inventaire vivant. Suppose que ces items sont sous la main, sauf
si la rotation est dépassée (last_purchased_at + rotation_months passé) →
suggérer renouvellement dans la liste de courses.

DATE DE LA SEMAINE PLANIFIÉE
{{week_start_date}} (jour 1 = lundi)

PRINCIPES NON NÉGOCIABLES

1. RAISONNE EN BASES MODULAIRES, PAS EN PLATS CLOS.
   Une cuisson dominicale doit servir 2-3 repas sous des formes différentes.
   Exemple : poulet rôti dimanche → poulet-pommes lundi soir, salade poulet
   noisettes mercredi midi, wrap poulet-tahini jeudi soir.
   Cuissons longues (rôtis, braises, légumineuses) le dimanche, assemblages
   vifs en semaine.

2. RESPECTE LES CONTRAINTES DE TEMPS DE L'UTILISATEUR.
   - Dimanche : {{inputs.sunday_time_min}} minutes max
   - Semaine : {{inputs.weekday_max_min}} minutes max par assemblage

3. STOCKAGE LIMITÉ. Petit congélateur. Maximum 2-3 portions à congeler /sem.

4. SAISONNALITÉ FRANCE MÉTROPOLITAINE selon la date {{week_start_date}}.
   Sois souple : note "saison limite" dans warnings si applicable, ne refuse
   pas pour autant. Privilégie les produits de pleine saison.

5. LIEUX DE COURSES — GROUPEMENT À DEUX NIVEAUX.
   Tu produis la liste de courses groupée par lieu (selon user_locations).
   POUR CHAQUE ITEM, tu indiques `freshness_urgency` :
   - "day_of_cooking" : à acheter le jour de la cuisson (poisson, herbes,
     salades fragiles, viande blanche, fruits de mer)
   - "flexible" : peut être acheté avant (épicerie, viande de batch,
     légumes-racines, etc.)

6. CUISINIER CONFIRMÉ. Recettes 3-5 lignes max. N'explique pas les bases
   (vinaigrette, cuisson de pâtes, blanchir des légumes). Va à l'essentiel :
   températures, timings, points de vigilance, proportions clé.

7. ENVIES EXPLICITES = à honorer. Si l'utilisateur écrit "raclette", tu
   l'intègres ou tu expliques pourquoi tu l'écartes (ex: incompatible batch
   ou écrase le budget).

8. ANTI-RÉPÉTITION : évite les plats listés dans recent_meals (8 dernières
   semaines) sauf demande explicite de l'utilisateur.

9. PETIT-DÉJEUNER (si demandé) : propose 2-3 options récurrentes pour la
   semaine, avec si possible une prep dominicale (overnight oats, granola
   maison) + un quotidien rapide. Intègre les ingrédients dans la liste
   de courses.

10. RÉPONDS UNIQUEMENT EN JSON VALIDE selon le schéma fourni. Aucun préambule,
    aucun markdown, aucun commentaire hors du JSON.
```

### 7.3 Schéma de sortie LLM (zod, dans `packages/shared`)

```ts
const PlanOutputSchema = z.object({
  week_start_date: z.string(),  // ISO date
  philosophy_summary: z.string(),  // 2-3 phrases : la logique de la semaine
  sunday_batch: z.object({
    estimated_total_time_min: z.number(),
    preparations: z.array(z.object({
      name: z.string(),
      time_min: z.number(),
      short_instructions: z.string(),  // 3-5 lignes
      yields_for_slots: z.array(z.string()),  // ex: ["lundi-soir", "mardi-midi"]
    })),
  }),
  daily_plan: z.array(z.object({
    day: z.enum(["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]),
    lunch: z.object({
      meal: z.string(),
      assembly_note: z.string(),  // ce qu'il faut faire le jour J
      assembly_time_min: z.number(),
    }).nullable(),
    dinner: z.object({
      meal: z.string(),
      assembly_note: z.string(),
      assembly_time_min: z.number(),
    }).nullable(),
  })),
  breakfast: z.object({
    sunday_prep: z.array(z.object({
      name: z.string(),
      short_instructions: z.string(),
      keeps_days: z.number(),
    })),
    daily_options: z.array(z.string()),  // 2-3 options récurrentes
  }).nullable(),
  shopping_list: z.array(z.object({
    location_id: z.string().uuid(),  // référence à user_locations
    location_name: z.string(),  // dénormalisé pour affichage
    items: z.array(z.object({
      item: z.string(),
      qty: z.string(),  // texte libre : "500g", "1 botte", "3 pièces"
      category: z.string().optional(),  // boucherie, fromagerie, etc.
      freshness_urgency: z.enum(["day_of_cooking", "flexible"]),
    })),
  })),
  pantry_renewal_suggestions: z.array(z.object({
    pantry_target_id: z.string().uuid(),
    name: z.string(),
    reason: z.string(),  // "rotation dépassée", "consommé en quantité"
  })),
  estimated_cost_eur: z.number(),
  warnings: z.array(z.string()),  // saisonnalité limite, etc.
});
```

---

## 8. Endpoints API (consolidé)

```
Auth
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/logout
  GET    /api/auth/me

User
  GET    /api/users/me
  PUT    /api/users/me
  PUT    /api/users/me/onboarding
  GET    /api/users/me/export
  DELETE /api/users/me

Foyer
  GET    /api/household
  PUT    /api/household

Lieux de courses
  GET    /api/locations
  POST   /api/locations
  PUT    /api/locations/:id
  DELETE /api/locations/:id
  POST   /api/locations/suggest    body: { city: string } → propositions LLM

Préférences
  GET    /api/preferences
  PUT    /api/preferences

Cibles garde-manger
  GET    /api/pantry-targets
  POST   /api/pantry-targets
  PATCH  /api/pantry-targets/:id           // ex: marquer "j'ai racheté"
  DELETE /api/pantry-targets/:id
  POST   /api/pantry-targets/bulk-init     // onboarding
  POST   /api/pantry-targets/:id/restocked // raccourci : last_purchased_at = today

Plans hebdo
  POST   /api/plans/generate
  POST   /api/plans/:id/regenerate         // body: { feedback: string }
  POST   /api/plans/:id/finalize
  GET    /api/plans
  GET    /api/plans/:id
  PATCH  /api/plans/:id                    // notes, ajustements
  GET    /api/plans/active                 // le plan en cours (status=active)

Repas et notations
  GET    /api/meal-entries/favorites
  PATCH  /api/meal-entries/:id             // ex: toggle is_favorite
  POST   /api/ratings                      // body: [{ meal_entry_id, rating, comment }]
  GET    /api/ratings/recent

Liste de courses
  PATCH  /api/plans/:id/shopping-list     // édition manuelle de la liste
```

---

## 9. Frontend — écrans

### 9.1 Routing

```
/login
/register
/onboarding/[step]
/                        # accueil contextuel
/plan/new                # formulaire de génération
/plan/:id                # affichage d'un plan
/plan/:id/shopping       # vue liste de courses (focus courses)
/plan/:id/today          # vue du jour (mode semaine)
/history                 # plans passés
/favorites               # repas favoris
/preferences             # édition prefs + foyer + lieux + pantry-targets
/legal
```

### 9.2 Accueil contextuel

Le composant `<Home />` détermine son mode selon `getHomeMode(today, activePlan)` :

| Mode               | Condition                                                     | Affichage principal                                            |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `to-generate`      | Pas de plan actif OU plan actif = semaine passée              | CTA "Générer le plan de la semaine prochaine"                  |
| `shopping`         | Plan actif draft ou active, on est entre vendredi et samedi   | Liste de courses du plan, focus marché du jour                 |
| `cooking`          | Plan actif, on est dimanche                                   | Préparations du dimanche, ordre suggéré, timer                 |
| `weekday`          | Plan actif, on est lun-ven                                    | Repas du jour (midi+soir), assembly_note, sortie congel        |
| `feedback-pending` | Plan terminé, ratings non saisis                              | "Comment s'est passée la semaine ?" → modale de notation rapide|

Sous l'affichage principal, toujours présents : raccourci favoris, lien historique,
alertes pantry rotations dépassées.

### 9.3 Formulaire de génération

Une page, formulaire long mais aéré. Les valeurs par défaut sont mémorisées
(localStorage) pour ne pas tout ressaisir chaque semaine.

### 9.4 Vue plan

Sections :
1. Header : philosophy_summary + warnings + bouton "régénérer avec feedback"
2. Petit-déj (si activé) : prep dominicale + options quotidiennes
3. Dimanche batch : timeline des préparations avec timers et instructions courtes
4. Semaine : tableau jour × midi/soir avec assembly_note, étoile favori cliquable
5. Liste de courses : par lieu, items "à acheter le jour J" en surbrillance
6. Suggestions de renouvellement pantry
7. Actions : finaliser le plan, exporter markdown, imprimer la liste

### 9.5 Vue liste de courses (mobile-friendly)

Optimisée pour usage en magasin. Cases à cocher persistantes (état dans le plan
`output_json` ou table à part `shopping_check_state` — pour v1, dans un champ
`check_state` du plan, simple). Filtre par lieu, filtre "à acheter aujourd'hui".

### 9.6 Vue jour (mode semaine)

Affichage focalisé : "Aujourd'hui mardi — midi : X / soir : Y". Rappel "sortir
du congel ce matin si applicable". Bouton vers le détail du plan complet.

---

## 10. Outillage prompt — sandbox CLI

Dans `tools/prompt-sandbox/` :

```
tools/prompt-sandbox/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # CLI entrypoint
│   ├── fixtures/
│   │   ├── user-fx.json  # jeu de données réaliste
│   │   └── user-jean.json
│   └── runner.ts         # construit prompt, appelle API, valide
└── README.md
```

### 10.1 Usage CLI

```bash
# génération avec un fixture user
pnpm sandbox generate --user fx --week 2026-05-10

# avec inputs custom
pnpm sandbox generate --user fx --week 2026-05-10 \
  --envies "agneau, carbo, raclette" --sunday-time 120

# régénération avec feedback
pnpm sandbox regenerate --user fx --week 2026-05-10 \
  --feedback "trop de viande rouge, remplace mardi soir"

# affiche le prompt système courant (sans appel API)
pnpm sandbox show-prompt --user fx
```

Sortie : le prompt complet envoyé, la réponse brute, et le JSON parsé.
Stocke un log dans `tools/prompt-sandbox/logs/{timestamp}.json`.

### 10.2 Bénéfice
Itérer sur le prompt système sans déployer ni passer par l'UI. Tester rapidement
"qu'est-ce qui change si je modifie cette ligne" en appelant l'API plusieurs fois
sur le même user. Permet aussi de produire des fixtures pour tests.

---

## 11. Découpage en tâches Claude Code

Calibré pour des sessions de 30-60 min chacune, à lancer indépendamment pour
éviter les timeouts. Chaque tâche produit un commit propre testable.

### Phase 1 — Backend foundations
- **T1** : Bootstrap monorepo (pnpm workspaces, configs partagées)
- **T2** : Setup Drizzle + connexion DB + migrations users + sessions
- **T3** : Auth complet (register, login, logout, middleware, hash argon2, JWT)
- **T4** : Middleware d'erreur global + logging Pino + healthcheck
- **T5** : Migrations restantes (households, locations, preferences, pantry_targets,
         plans, meal_entries, ratings, llm_logs)

### Phase 2 — CRUD métier
- **T6** : Endpoints household + locations + preferences (CRUD + tests)
- **T7** : Endpoints pantry_targets (CRUD + bulk-init + restocked + tests)
- **T8** : Schémas zod partagés dans `packages/shared` (inputs, plan output)

### Phase 3 — Cœur LLM
- **T9** : Module LLM (client Anthropic, builder de prompt système, builder
         de prompt user, parsing/validation, retry, cost tracking)
- **T10** : Endpoint /api/plans/generate + persistence + meal_entries
- **T11** : Endpoint /api/plans/:id/regenerate + finalize
- **T12** : Endpoints meal-entries (favoris) + ratings + history
- **T13** : Sandbox CLI dans tools/prompt-sandbox

### Phase 4 — Frontend
- **T14** : Setup Vite + Tailwind + routing + auth context + intercepteurs
- **T15** : Pages login/register + onboarding wizard (5 étapes)
- **T16** : Page accueil contextuel (logique de mode + composants par mode)
- **T17** : Formulaire de génération + appel API + page plan
- **T18** : Vue plan détaillée (sections sunday/weekday/shopping/breakfast)
- **T19** : Vue liste de courses optimisée + état de cochage
- **T20** : Vue jour + raccourcis navigation
- **T21** : Pages préférences (foyer + lieux + prefs + pantry) + favoris + history
- **T22** : Modale de notation + flow feedback de semaine
- **T23** : Export markdown + vue impression liste de courses
- **T24** : Page legal + export RGPD + suppression compte

### Phase 5 — Production
- **T25** : Variables d'env + secrets management
- **T26** : Dockerfile / scripts PM2 + config Nginx
- **T27** : Backup automatique DB + monitoring basique
- **T28** : Documentation README + déploiement initial sur VPS

**Total estimé** : 28 tâches, ~25-35h de travail effectif Claude Code.

---

## 12. Hors scope v1 (à acter pour v1.1+)

- Inventaire vivant du congélateur (cong actuelle = à l'œil)
- Suggestion de réutilisation des restes (point 3 du brief)
- Rejeu d'un plan passé en un clic (les favoris suffisent en v1)
- Remplacement individuel d'un repas (la régénération avec feedback couvre)
- Suivi budget réel vs estimé
- OCR ticket de caisse
- Mobile-first / PWA / notifications
- Partage de plans entre users
- Import/export entre comptes
- Mode "famille" multi-cuisinier sur même compte

---

## 13. Risques et points d'attention

### 13.1 Risques techniques
- **Timeout API LLM** : un plan complet peut prendre 20-40s à générer. Prévoir
  timeout HTTP serveur ≥ 90s, indicateur de progression frontend, gestion
  d'erreur réseau côté client (retry idempotent côté user).
- **Coût API** : un plan complet ~ 8-15k tokens input + 3-5k output. Estimation
  ~5-10 centimes par génération. Multi-users = à monitorer (logs llm_logs +
  alerte si dépassement budget mensuel).
- **JSON malformé** : Sonnet 4.5 est très fiable mais ça arrive. Le retry
  unique avec message d'erreur explicite résout 99% des cas.

### 13.2 Risques produit
- **Onboarding trop long** = abandon. Garder strict : 5 étapes max, options
  raisonnables.
- **Plans répétitifs au bout de 3 mois** : surveiller. Si ça arrive, durcir
  la consigne anti-répétition ou élargir la fenêtre recent_meals.
- **Frustration sur saisonnalité** : si le LLM se trompe régulièrement,
  envisager v1.1 avec table d'overrides régionaux.

### 13.3 Points à valider après usage réel
- Le rythme batch vs assemblage convient-il en pratique ?
- La granularité du feedback de notation est-elle suffisante (-1/0/1) ?
- Les "freshness_urgency" sont-elles utiles ou bruit ?
- Le petit-déj récurrent fatigue-t-il en 2-3 semaines ?
