import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
  display_name: z.string().min(1, 'Le nom est requis').max(100),
})

// Le login n'applique pas de min sur le password pour éviter de donner des indices
// sur la politique de mot de passe à quelqu'un qui teste des credentials.
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>

// ─── Household ────────────────────────────────────────────────────────────────

export const HouseholdUpdateSchema = z.object({
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  // Âges des enfants (années révolues) — permet au LLM d'adapter portions, goûters et textures
  children_ages: z.array(z.number().int().min(0).max(17)).max(10).optional(),
  description: z.string().max(500).nullish(),
})

export type HouseholdUpdateInput = z.infer<typeof HouseholdUpdateSchema>

// ─── Locations ────────────────────────────────────────────────────────────────

export const LOCATION_KINDS = [
  'supermarche',
  'bio',
  'marche',
  'primeur',
  'boucherie',
  'fromagerie',
  'autre',
] as const

export type LocationKind = (typeof LOCATION_KINDS)[number]

export const LocationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(LOCATION_KINDS),
  notes: z.string().max(1000).nullish(),
  priority: z.number().int().min(0).default(0),
})

export const LocationUpdateSchema = LocationCreateSchema.partial()

export type LocationCreateInput = z.infer<typeof LocationCreateSchema>
export type LocationUpdateInput = z.infer<typeof LocationUpdateSchema>

// ─── Pantry targets ───────────────────────────────────────────────────────────

export const PANTRY_CATEGORIES = [
  'cereales',
  'legumineuses',
  'conserves',
  'huiles_vinaigres',
  'epices',
  'condiments',
  'boissons',
  'sucres_farines',
  'secs_divers',
  'autre',
] as const

export const PANTRY_UNITS = ['kg', 'g', 'L', 'mL', 'pieces', 'boites', 'sachets'] as const

export const PANTRY_PRIORITIES = ['essentiel', 'secondaire'] as const

// État de stock déclaré par l'utilisateur (pas un inventaire au gramme près).
// 'vide' → le LLM ne doit pas supposer l'article disponible et l'ajoute aux courses si besoin.
export const STOCK_STATUSES = ['ok', 'bas', 'vide'] as const

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number]
export type PantryUnit = (typeof PANTRY_UNITS)[number]
export type PantryPriority = (typeof PANTRY_PRIORITIES)[number]
export type StockStatus = (typeof STOCK_STATUSES)[number]

export const PantryTargetCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(PANTRY_CATEGORIES),
  targetQuantity: z.number().positive(),
  unit: z.enum(PANTRY_UNITS),
  rotationMonths: z.number().int().min(1).default(6),
  priority: z.enum(PANTRY_PRIORITIES),
  stockStatus: z.enum(STOCK_STATUSES).default('ok'),
  preferredLocationId: z.string().uuid().nullish(),
  notes: z.string().max(1000).nullish(),
})

export const PantryTargetUpdateSchema = PantryTargetCreateSchema.partial()

export const PantryBulkInitSchema = z.object({
  targets: z.array(PantryTargetCreateSchema).min(1).max(50),
})

export type PantryTargetCreateInput = z.infer<typeof PantryTargetCreateSchema>
export type PantryTargetUpdateInput = z.infer<typeof PantryTargetUpdateSchema>
export type PantryBulkInitInput = z.infer<typeof PantryBulkInitSchema>

// ─── Preferences ──────────────────────────────────────────────────────────────

export const COOKING_COMPLEXITY = ['simple', 'intermediate', 'elaborate'] as const
export type CookingComplexity = (typeof COOKING_COMPLEXITY)[number]

// Régime carné du foyer — préférence durable, éditable dans le profil
export const DIET_REGIMES = ['vegetarien', 'flexitarien', 'carnivore'] as const
export type DietRegime = (typeof DIET_REGIMES)[number]

// Niveau de menu — oriente le coût et le standing des plans générés
export const MENU_TIERS = ['economique', 'normal', 'luxe'] as const
export type MenuTier = (typeof MENU_TIERS)[number]

export const PreferencesUpdateSchema = z.object({
  loves: z.array(z.string().min(1)).optional(),
  dislikes: z.array(z.string().min(1)).optional(),
  allergies: z.array(z.string().min(1)).optional(),
  current_phase: z.string().max(200).nullish(),
  dietary_targets: z.record(z.string()).nullish(),
  cooking_complexity: z.enum(COOKING_COMPLEXITY).optional(),
  diet_regime: z.enum(DIET_REGIMES).optional(),
  fish_ok: z.boolean().optional(),
  menu_tier: z.enum(MENU_TIERS).optional(),
  local_specialties: z.string().max(1000).nullish(),
  notes: z.string().max(1000).nullish(),
})

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>

// ─── Plan : inputs génération ─────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

// Slot au format "lundi-midi" | "lundi-soir" | ...
const coveredSlotPattern = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)-(midi|soir)$/

// Desserts : 'simple' = fruits/laitages aux courses, 'gourmand' = en plus une pâtisserie du dimanche
export const DESSERT_MODES = ['aucun', 'simple', 'gourmand'] as const
export type DessertMode = (typeof DESSERT_MODES)[number]

export const GeneratePlanInputSchema = z.object({
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date ISO YYYY-MM-DD attendue'),
  cravings: z.string().max(500).optional(),
  surprise_mode: z.boolean().default(false),
  include_breakfast: z.boolean().default(true),
  include_snacks: z.boolean().default(false),
  dessert_mode: z.enum(DESSERT_MODES).default('aucun'),
  sunday_prep_count: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  // Durée en minutes : valeurs slider 60/90/120/150/180/210+
  sunday_time_min: z.number().int().min(60),
  // Valeurs slider 10/15/20/30 min
  weekday_max_assembly_min: z.union([
    z.literal(10),
    z.literal(15),
    z.literal(20),
    z.literal(30),
  ]),
  covered_slots: z
    .array(z.string().regex(coveredSlotPattern, 'Format attendu : "lundi-midi"'))
    .min(1, 'Au moins un créneau doit être couvert'),
  budget_eur: z.number().positive().optional(),
  free_note: z.string().max(1000).optional(),
})

export type GeneratePlanInput = z.infer<typeof GeneratePlanInputSchema>

export const RegeneratePlanInputSchema = z.object({
  feedback: z.string().min(1).max(2000),
})

export type RegeneratePlanInput = z.infer<typeof RegeneratePlanInputSchema>

// ─── Plan : sortie LLM ────────────────────────────────────────────────────────

const MealSlotSchema = z
  .object({
    meal: z.string(),
    assembly_note: z.string(),
    assembly_time_min: z.number(),
  })
  .nullable()

export const PlanOutputSchema = z.object({
  week_start_date: z.string(),
  // 2-3 phrases : la logique de la semaine
  philosophy_summary: z.string(),

  sunday_batch: z.object({
    estimated_total_time_min: z.number(),
    preparations: z.array(
      z.object({
        name: z.string(),
        time_min: z.number(),
        short_instructions: z.string(),
        yields_for_slots: z.array(z.string()),
      }),
    ),
  }),

  daily_plan: z.array(
    z.object({
      day: z.enum(DAYS_OF_WEEK),
      lunch: MealSlotSchema,
      dinner: MealSlotSchema,
    }),
  ),

  breakfast: z
    .object({
      sunday_prep: z.array(
        z.object({
          name: z.string(),
          short_instructions: z.string(),
          keeps_days: z.number(),
        }),
      ),
      daily_options: z.array(z.string()),
    })
    .nullable(),

  // Goûters et desserts : même forme que breakfast.
  // nullish (et non nullable) pour rester compatible avec les plans générés avant v5.
  snacks: z
    .object({
      sunday_prep: z.array(
        z.object({
          name: z.string(),
          short_instructions: z.string(),
          keeps_days: z.number(),
        }),
      ),
      daily_options: z.array(z.string()),
    })
    .nullish(),

  desserts: z
    .object({
      sunday_prep: z.array(
        z.object({
          name: z.string(),
          short_instructions: z.string(),
          keeps_days: z.number(),
        }),
      ),
      daily_options: z.array(z.string()),
    })
    .nullish(),

  shopping_list: z.array(
    z.object({
      location_id: z.string().uuid(),
      location_name: z.string(),
      items: z.array(
        z.object({
          item: z.string(),
          qty: z.string(),
          category: z.string().optional(),
          freshness_urgency: z.enum(['day_of_cooking', 'flexible']),
        }),
      ),
    }),
  ),

  pantry_renewal_suggestions: z.array(
    z.object({
      pantry_target_id: z.string().uuid(),
      name: z.string(),
      reason: z.string(),
    }),
  ),

  estimated_cost_eur: z.number(),
  warnings: z.array(z.string()),
})

export type PlanOutput = z.infer<typeof PlanOutputSchema>

// ─── Admin ────────────────────────────────────────────────────────────────────

export const AdminCreditsAdjustSchema = z.object({
  delta: z.number().int().min(-1000).max(1000).refine((d) => d !== 0, 'delta ne peut pas être 0'),
})

export const AdminSettingsUpdateSchema = z.object({
  llm_model: z.string().min(1).max(100).optional(),
  prompt_version: z.string().min(1).max(20).optional(),
})

export type AdminCreditsAdjustInput = z.infer<typeof AdminCreditsAdjustSchema>
export type AdminSettingsUpdateInput = z.infer<typeof AdminSettingsUpdateSchema>

// ─── Meal entries & ratings ───────────────────────────────────────────────────

export const MealEntryUpdateSchema = z.object({
  is_favorite: z.boolean().optional(),
  // null = effacer la date de dégustation
  eaten_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date ISO YYYY-MM-DD attendue').nullable().optional(),
})

export type MealEntryUpdateInput = z.infer<typeof MealEntryUpdateSchema>

// Rating unique (pour usage interne ou futur endpoint single)
export const MealRatingCreateSchema = z.object({
  // -1 = ne veut plus, 0 = neutre, 1 = coup de cœur
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
})

export type MealRatingCreate = z.infer<typeof MealRatingCreateSchema>

// Notation en lot — utilisée par POST /api/ratings (modale de fin de semaine)
const RatingItemSchema = z.object({
  meal_entry_id: z.string().uuid(),
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  comment: z.string().max(500).optional(),
})

export const RatingsBatchSchema = z.array(RatingItemSchema).min(1).max(50)

export type RatingsBatchInput = z.infer<typeof RatingsBatchSchema>
