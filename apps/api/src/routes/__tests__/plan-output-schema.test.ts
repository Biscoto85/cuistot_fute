import { describe, expect, it } from 'vitest'
import { GeneratePlanInputSchema, PlanOutputSchema, RegeneratePlanInputSchema } from '@cuistot/shared'

// ─── PlanOutputSchema — parsing réponse LLM ───────────────────────────────────

const LOCATION_UUID = '00000000-0000-0000-0000-000000000001'
const PANTRY_UUID = '00000000-0000-0000-0000-000000000002'

const validPlanOutput = {
  week_start_date: '2025-05-12',
  philosophy_summary: 'Semaine centrée sur le poulet rôti et les légumineuses. Batch dimanche en 2h. Assemblages < 15 min en semaine.',
  sunday_batch: {
    estimated_total_time_min: 120,
    preparations: [
      {
        name: 'Poulet rôti',
        time_min: 90,
        short_instructions: 'Badigeonner d\'huile, sel, thym. Four 200°C 1h20. Laisser reposer 10 min avant de découper.',
        yields_for_slots: ['lundi-midi', 'mardi-soir'],
      },
      {
        name: 'Lentilles mijotées',
        time_min: 40,
        short_instructions: 'Faire revenir oignon, lancer lentilles vertes + bouillon 40 min. Saler en fin de cuisson.',
        yields_for_slots: ['lundi-soir', 'mercredi-midi'],
      },
    ],
  },
  daily_plan: [
    { day: 'lundi', lunch: { meal: 'Salade poulet-roquette', assembly_note: 'Effilocher le poulet froid, mélanger avec roquette et vinaigrette.', assembly_time_min: 8 }, dinner: { meal: 'Lentilles au cumin', assembly_note: 'Réchauffer les lentilles, ajouter un filet de crème.', assembly_time_min: 5 } },
    { day: 'mardi', lunch: null, dinner: { meal: 'Poulet riz basmati', assembly_note: 'Cuire le riz 12 min, réchauffer le poulet à la poêle.', assembly_time_min: 15 } },
    { day: 'mercredi', lunch: { meal: 'Soupe lentilles-carottes', assembly_note: 'Mixer les lentilles avec bouillon chaud et carottes râpées.', assembly_time_min: 10 }, dinner: null },
    { day: 'jeudi', lunch: null, dinner: null },
    { day: 'vendredi', lunch: null, dinner: null },
    { day: 'samedi', lunch: null, dinner: null },
    { day: 'dimanche', lunch: null, dinner: null },
  ],
  breakfast: {
    sunday_prep: [
      {
        name: 'Granola maison',
        short_instructions: 'Mélanger flocons, miel, huile de coco. Étaler sur plaque. Four 170°C 20-25 min en remuant à mi-cuisson.',
        keeps_days: 14,
      },
    ],
    daily_options: ['Granola + yaourt', 'Tartines beurre-confiture', 'Porridge express'],
  },
  shopping_list: [
    {
      location_id: LOCATION_UUID,
      location_name: 'Biocoop Senlis',
      items: [
        { item: 'Poulet fermier entier', qty: '1.8 kg', category: 'volaille', freshness_urgency: 'day_of_cooking' },
        { item: 'Lentilles vertes', qty: '400 g', freshness_urgency: 'flexible' },
        { item: 'Flocons d\'avoine', qty: '300 g', freshness_urgency: 'flexible' },
      ],
    },
  ],
  pantry_renewal_suggestions: [
    {
      pantry_target_id: PANTRY_UUID,
      name: 'Huile d\'olive',
      reason: 'Rotation de 6 mois dépassée — dernier achat il y a 7 mois.',
    },
  ],
  estimated_cost_eur: 52.5,
  warnings: ['Asperges hors pleine saison — privilégier les poireaux à la place.'],
}

describe('PlanOutputSchema — réponse LLM valide', () => {
  it('parse une réponse complète sans erreur', () => {
    const result = PlanOutputSchema.safeParse(validPlanOutput)
    expect(result.success).toBe(true)
  })

  it('accepte breakfast null (si non demandé)', () => {
    const result = PlanOutputSchema.safeParse({ ...validPlanOutput, breakfast: null })
    expect(result.success).toBe(true)
  })

  it('accepte une shopping_list vide', () => {
    const result = PlanOutputSchema.safeParse({ ...validPlanOutput, shopping_list: [] })
    expect(result.success).toBe(true)
  })

  it('accepte des pantry_renewal_suggestions vides', () => {
    const result = PlanOutputSchema.safeParse({ ...validPlanOutput, pantry_renewal_suggestions: [] })
    expect(result.success).toBe(true)
  })

  it('accepte des warnings vides', () => {
    const result = PlanOutputSchema.safeParse({ ...validPlanOutput, warnings: [] })
    expect(result.success).toBe(true)
  })
})

describe('PlanOutputSchema — réponse LLM invalide', () => {
  it('rejette si daily_plan est absent', () => {
    const { daily_plan: _, ...without } = validPlanOutput
    const result = PlanOutputSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('rejette si un jour est invalide', () => {
    const bad = {
      ...validPlanOutput,
      daily_plan: [
        { day: 'monday', lunch: null, dinner: null },  // anglais → invalide
      ],
    }
    const result = PlanOutputSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejette si freshness_urgency est invalide', () => {
    const bad = {
      ...validPlanOutput,
      shopping_list: [
        {
          location_id: LOCATION_UUID,
          location_name: 'Biocoop',
          items: [{ item: 'Poulet', qty: '1kg', freshness_urgency: 'asap' }],  // valeur hors enum
        },
      ],
    }
    const result = PlanOutputSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejette si location_id n\'est pas un UUID valide', () => {
    const bad = {
      ...validPlanOutput,
      shopping_list: [
        { location_id: 'pas-un-uuid', location_name: 'Biocoop', items: [] },
      ],
    }
    const result = PlanOutputSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejette si estimated_cost_eur est absent', () => {
    const { estimated_cost_eur: _, ...without } = validPlanOutput
    const result = PlanOutputSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('rejette si sunday_batch manque', () => {
    const { sunday_batch: _, ...without } = validPlanOutput
    const result = PlanOutputSchema.safeParse(without)
    expect(result.success).toBe(false)
  })
})

// ─── GeneratePlanInputSchema ──────────────────────────────────────────────────

describe('GeneratePlanInputSchema', () => {
  const validInput = {
    week_start_date: '2025-05-12',
    sunday_time_min: 120,
    weekday_max_assembly_min: 15,
    covered_slots: ['lundi-midi', 'lundi-soir', 'mardi-soir'],
  }

  it('accepte un input minimal valide (defaults appliqués)', () => {
    const result = GeneratePlanInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.include_breakfast).toBe(true)
      expect(result.data.surprise_mode).toBe(false)
      expect(result.data.sunday_prep_count).toBe(3)
    }
  })

  it('rejette une date mal formatée', () => {
    const result = GeneratePlanInputSchema.safeParse({ ...validInput, week_start_date: '12/05/2025' })
    expect(result.success).toBe(false)
  })

  it('rejette un weekday_max_assembly_min hors valeurs autorisées', () => {
    const result = GeneratePlanInputSchema.safeParse({ ...validInput, weekday_max_assembly_min: 25 })
    expect(result.success).toBe(false)
  })

  it('rejette un slot au mauvais format', () => {
    const result = GeneratePlanInputSchema.safeParse({ ...validInput, covered_slots: ['monday-lunch'] })
    expect(result.success).toBe(false)
  })

  it('rejette covered_slots vide', () => {
    const result = GeneratePlanInputSchema.safeParse({ ...validInput, covered_slots: [] })
    expect(result.success).toBe(false)
  })

  it('rejette sunday_time_min < 60', () => {
    const result = GeneratePlanInputSchema.safeParse({ ...validInput, sunday_time_min: 30 })
    expect(result.success).toBe(false)
  })
})

// ─── RegeneratePlanInputSchema ────────────────────────────────────────────────

describe('RegeneratePlanInputSchema', () => {
  it('accepte un feedback valide', () => {
    const result = RegeneratePlanInputSchema.safeParse({ feedback: 'Trop de viande rouge, remplace le mardi soir.' })
    expect(result.success).toBe(true)
  })

  it('rejette un feedback vide', () => {
    const result = RegeneratePlanInputSchema.safeParse({ feedback: '' })
    expect(result.success).toBe(false)
  })

  it('rejette si feedback absent', () => {
    const result = RegeneratePlanInputSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
