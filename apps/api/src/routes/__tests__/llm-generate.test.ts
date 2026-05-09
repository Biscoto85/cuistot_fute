import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (ordre critique : avant tout import des modules dépendants) ──────────

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(),
  },
}))

vi.mock('@/llm/client', () => ({
  anthropic: {
    messages: { create: vi.fn() },
  },
}))

import { db } from '@/db'
import { anthropic } from '@/llm/client'
import { generatePlan } from '@/llm/generate'
import { buildSystemPrompt, buildUserMessage, buildRetryMessage } from '@/llm/prompt-builder'
import type { LlmUserContext } from '@/llm/types'
import type { GeneratePlanInput } from '@cuistot/shared'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const LOC_UUID = '11111111-1111-1111-1111-111111111111'
const PT_UUID = '22222222-2222-2222-2222-222222222222'

const ctx: LlmUserContext = {
  user: { displayName: 'François-Xavier' },
  household: { adults: 2, children: 0, description: 'Couple, cuisine le dimanche.' },
  preferences: {
    loves: ['poulet', 'légumineuses', 'cuisine asiatique'],
    dislikes: ['betterave'],
    allergies: [],
    currentPhase: null,
    cookingComplexity: 'intermediate',
    dietaryTargets: null,
    localSpecialties: 'Senlis — bons maraîchers du marché',
    notes: null,
  },
  locations: [{ id: LOC_UUID, name: 'Biocoop Senlis', kind: 'bio', notes: null }],
  pantryTargets: [
    { id: PT_UUID, name: 'Lentilles vertes', targetQuantity: '2', unit: 'kg', rotationMonths: 6, lastPurchasedAt: '2025-01-15', priority: 'essentiel' },
  ],
  recentWeeklyMeals: [],
  recentRatings: [],
  favoriteMeals: [],
}

const inputs: GeneratePlanInput = {
  week_start_date: '2025-05-12',
  sunday_time_min: 120,
  weekday_max_assembly_min: 15,
  covered_slots: ['lundi-midi', 'lundi-soir', 'mardi-soir'],
  include_breakfast: true,
  surprise_mode: false,
  sunday_prep_count: 3,
}

const validPlanOutput = {
  week_start_date: '2025-05-12',
  philosophy_summary: 'Semaine légère, légumineuses en base.',
  sunday_batch: {
    estimated_total_time_min: 120,
    preparations: [{ name: 'Poulet rôti', time_min: 90, short_instructions: 'Four 200°C, 1h20.', yields_for_slots: ['lundi-midi', 'lundi-soir'] }],
  },
  daily_plan: [
    { day: 'lundi', lunch: { meal: 'Salade poulet', assembly_note: 'Effilocher.', assembly_time_min: 8 }, dinner: { meal: 'Poulet riz', assembly_note: 'Réchauffer.', assembly_time_min: 10 } },
    { day: 'mardi', lunch: null, dinner: { meal: 'Lentilles', assembly_note: 'Réchauffer.', assembly_time_min: 5 } },
    { day: 'mercredi', lunch: null, dinner: null },
    { day: 'jeudi', lunch: null, dinner: null },
    { day: 'vendredi', lunch: null, dinner: null },
    { day: 'samedi', lunch: null, dinner: null },
    { day: 'dimanche', lunch: null, dinner: null },
  ],
  breakfast: { sunday_prep: [{ name: 'Granola', short_instructions: 'Four 170°C 20min.', keeps_days: 14 }], daily_options: ['Granola', 'Tartines'] },
  shopping_list: [{ location_id: LOC_UUID, location_name: 'Biocoop', items: [{ item: 'Poulet', qty: '1.8kg', freshness_urgency: 'day_of_cooking' }] }],
  pantry_renewal_suggestions: [],
  estimated_cost_eur: 45,
  warnings: [],
}

function mockAnthropic(text: string, inputTokens = 500, outputTokens = 800) {
  vi.mocked(anthropic.messages.create).mockResolvedValueOnce({
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  } as any)
}

function mockDbInsert() {
  const values = vi.fn().mockResolvedValue([])
  vi.mocked(db.insert).mockReturnValue({ values } as any)
  return values
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generatePlan — chemin nominal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retourne PlanOutput si la réponse LLM est valide', async () => {
    mockDbInsert()
    mockAnthropic(JSON.stringify(validPlanOutput))

    const result = await generatePlan(ctx, inputs, 'user-1')

    expect(result.week_start_date).toBe('2025-05-12')
    expect(result.daily_plan).toHaveLength(7)
    // Un seul appel Anthropic
    expect(anthropic.messages.create).toHaveBeenCalledTimes(1)
    // Log inséré en DB
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it('accepte une réponse JSON enveloppée en markdown (retire les fences)', async () => {
    mockDbInsert()
    const wrapped = '```json\n' + JSON.stringify(validPlanOutput) + '\n```'
    mockAnthropic(wrapped)

    const result = await generatePlan(ctx, inputs, 'user-1')
    expect(result.week_start_date).toBe('2025-05-12')
  })
})

describe('generatePlan — retry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('réessaie une fois si la première réponse est du JSON invalide', async () => {
    mockDbInsert()
    // Premier appel : JSON invalide (champ requis manquant)
    mockAnthropic('{ "week_start_date": "2025-05-12" }')
    // Deuxième appel : valide
    mockAnthropic(JSON.stringify(validPlanOutput))

    const result = await generatePlan(ctx, inputs, 'user-1')

    expect(result.week_start_date).toBe('2025-05-12')
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2)
    // Le 2e appel doit inclure le message de retry (3 messages)
    const secondCall = vi.mocked(anthropic.messages.create).mock.calls[1][0]
    expect(secondCall.messages).toHaveLength(3)
  })

  it('réessaie une fois si la première réponse est du texte non-JSON', async () => {
    mockDbInsert()
    mockAnthropic('Voici votre plan de repas...')  // texte pur, non JSON
    mockAnthropic(JSON.stringify(validPlanOutput))

    const result = await generatePlan(ctx, inputs, 'user-1')
    expect(result.week_start_date).toBe('2025-05-12')
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2)
  })
})

describe('generatePlan — échec définitif', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lève une erreur et log en DB si les deux réponses sont invalides', async () => {
    mockDbInsert()
    mockAnthropic('invalide')
    mockAnthropic('encore invalide')

    await expect(generatePlan(ctx, inputs, 'user-1')).rejects.toThrow()
    // Le log d'erreur est quand même inséré
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it('lève une erreur et log si l\'API Anthropic échoue', async () => {
    mockDbInsert()
    vi.mocked(anthropic.messages.create).mockRejectedValueOnce(new Error('API timeout'))

    await expect(generatePlan(ctx, inputs, 'user-1')).rejects.toThrow('API timeout')
    expect(db.insert).toHaveBeenCalledTimes(1)
  })
})

describe('generatePlan — cost tracking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calcule et logue un coût estimé non nul', async () => {
    let capturedValues: Record<string, unknown> = {}
    const values = vi.fn().mockImplementation((v) => { capturedValues = v; return Promise.resolve([]) })
    vi.mocked(db.insert).mockReturnValue({ values } as any)

    mockAnthropic(JSON.stringify(validPlanOutput), 2000, 1000)

    await generatePlan(ctx, inputs, 'user-1')

    const cost = parseFloat(capturedValues.costEstimateEur as string)
    expect(cost).toBeGreaterThan(0)
    expect(capturedValues.tokensInput).toBe(2000)
    expect(capturedValues.tokensOutput).toBe(1000)
    expect(capturedValues.promptVersion).toBe('v1')
  })
})

// ─── Prompt builder (tests purs, sans mock) ───────────────────────────────────

describe('buildSystemPrompt', () => {
  it('remplace tous les placeholders connus', () => {
    const prompt = buildSystemPrompt(ctx, inputs)
    expect(prompt).toContain('François-Xavier')
    expect(prompt).toContain('2 adulte(s)')
    expect(prompt).toContain('poulet')
    expect(prompt).toContain('Biocoop Senlis')
    expect(prompt).toContain(LOC_UUID)
    expect(prompt).toContain(PT_UUID)
    expect(prompt).toContain('120')
    expect(prompt).toContain('15')
    expect(prompt).not.toContain('{{')  // aucun placeholder non remplacé
  })
})

describe('buildUserMessage', () => {
  it('contient les champs clés de la demande', () => {
    const msg = buildUserMessage(inputs)
    expect(msg).toContain('2025-05-12')
    expect(msg).toContain('lundi-midi')
    expect(msg).toContain('120 min')
    expect(msg).toContain('15 min')
  })

  it('mentionne le mode surprise si activé', () => {
    const msg = buildUserMessage({ ...inputs, surprise_mode: true })
    expect(msg).toContain('MODE SURPRISE')
  })

  it('inclut les envies si renseignées', () => {
    const msg = buildUserMessage({ ...inputs, cravings: 'raclette' })
    expect(msg).toContain('raclette')
  })
})

describe('buildRetryMessage', () => {
  it('contient l\'erreur de parsing', () => {
    const msg = buildRetryMessage('Champ daily_plan manquant')
    expect(msg).toContain('Champ daily_plan manquant')
  })
})
