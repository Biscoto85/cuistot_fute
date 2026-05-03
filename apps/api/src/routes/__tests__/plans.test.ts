import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (avant tout import qui en dépend) ────────────────────────────────────

vi.mock('@/db', () => ({
  db: {
    query: {
      weeklyPlans: { findMany: vi.fn(), findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/llm/context-loader', () => ({
  loadUserContext: vi.fn(),
}))

vi.mock('@/llm/generate', () => ({
  generatePlan: vi.fn(),
}))

import { db } from '@/db'
import { loadUserContext } from '@/llm/context-loader'
import { generatePlan } from '@/llm/generate'
import { createApp } from '@/app'
import { signToken } from '@/lib/auth'

const app = createApp()
const token = signToken({ sub: 'user-1', email: 'fx@test.com' })
const cookie = `auth_token=${token}`

const LOC_UUID = '11111111-1111-1111-1111-111111111111'

const validInput = {
  week_start_date: '2025-05-12',
  sunday_time_min: 120,
  weekday_max_assembly_min: 15,
  covered_slots: ['lundi-midi', 'lundi-soir'],
}

const validPlanOutput = {
  week_start_date: '2025-05-12',
  philosophy_summary: 'Semaine poulet.',
  sunday_batch: { estimated_total_time_min: 90, preparations: [] },
  daily_plan: [
    { day: 'lundi', lunch: { meal: 'Salade poulet', assembly_note: 'Effilocher.', assembly_time_min: 8 }, dinner: { meal: 'Riz poulet', assembly_note: 'Réchauffer.', assembly_time_min: 5 } },
    { day: 'mardi', lunch: null, dinner: null },
    { day: 'mercredi', lunch: null, dinner: null },
    { day: 'jeudi', lunch: null, dinner: null },
    { day: 'vendredi', lunch: null, dinner: null },
    { day: 'samedi', lunch: null, dinner: null },
    { day: 'dimanche', lunch: null, dinner: null },
  ],
  breakfast: null,
  shopping_list: [{ location_id: LOC_UUID, location_name: 'Biocoop', items: [] }],
  pantry_renewal_suggestions: [],
  estimated_cost_eur: 40,
  warnings: [],
}

const mockPlan = { id: 'plan-1', userId: 'user-1', weekStartDate: '2025-05-12', status: 'draft', inputsJson: validInput, outputJson: validPlanOutput, notes: null, createdAt: new Date(), updatedAt: new Date() }

function mockInsert(returnValue: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returnValue)
  const values = vi.fn().mockReturnValue({ returning })
  vi.mocked(db.insert).mockReturnValue({ values } as any)
  return { values, returning }
}

// ─── POST /api/plans/generate ──────────────────────────────────────────────────

describe('POST /api/plans/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/plans/generate').send(validInput)
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si week_start_date est mal formatée', async () => {
    const res = await request(app)
      .post('/api/plans/generate')
      .set('Cookie', cookie)
      .send({ ...validInput, week_start_date: '12-05-2025' })
    expect(res.status).toBe(400)
  })

  it('renvoie 400 si covered_slots est vide', async () => {
    const res = await request(app)
      .post('/api/plans/generate')
      .set('Cookie', cookie)
      .send({ ...validInput, covered_slots: [] })
    expect(res.status).toBe(400)
  })

  it('renvoie 400 si weekday_max_assembly_min est hors valeurs', async () => {
    const res = await request(app)
      .post('/api/plans/generate')
      .set('Cookie', cookie)
      .send({ ...validInput, weekday_max_assembly_min: 25 })
    expect(res.status).toBe(400)
  })

  it('renvoie 201 avec le plan et les meal_entries si tout est valide', async () => {
    vi.mocked(loadUserContext).mockResolvedValueOnce({} as any)
    vi.mocked(generatePlan).mockResolvedValueOnce(validPlanOutput as any)

    // Premier insert : weeklyPlans
    const returningPlan = vi.fn().mockResolvedValueOnce([mockPlan])
    const valuesPlan = vi.fn().mockReturnValue({ returning: returningPlan })
    // Deuxième insert : mealEntries
    const returningEntries = vi.fn().mockResolvedValueOnce([
      { id: 'entry-1', slot: 'lundi-midi', mealLabel: 'Salade poulet' },
      { id: 'entry-2', slot: 'lundi-soir', mealLabel: 'Riz poulet' },
    ])
    const valuesEntries = vi.fn().mockReturnValue({ returning: returningEntries })

    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: valuesPlan } as any)
      .mockReturnValueOnce({ values: valuesEntries } as any)

    const res = await request(app)
      .post('/api/plans/generate')
      .set('Cookie', cookie)
      .send(validInput)

    expect(res.status).toBe(201)
    expect(res.body.plan.id).toBe('plan-1')
    expect(res.body.entries).toHaveLength(2)
    // loadUserContext appelé avec le userId du cookie
    expect(loadUserContext).toHaveBeenCalledWith('user-1')
    // generatePlan appelé avec les inputs validés
    expect(generatePlan).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ week_start_date: '2025-05-12' }), 'user-1')
  })

  it('propage l\'erreur LLM (500) et ne persiste rien', async () => {
    vi.mocked(loadUserContext).mockResolvedValueOnce({} as any)
    vi.mocked(generatePlan).mockRejectedValueOnce(new Error('LLM timeout'))

    const res = await request(app)
      .post('/api/plans/generate')
      .set('Cookie', cookie)
      .send(validInput)

    expect(res.status).toBe(500)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('crée zéro meal_entries si le daily_plan est entièrement null', async () => {
    const allNullPlan = {
      ...validPlanOutput,
      daily_plan: [
        { day: 'lundi', lunch: null, dinner: null },
        { day: 'mardi', lunch: null, dinner: null },
        { day: 'mercredi', lunch: null, dinner: null },
        { day: 'jeudi', lunch: null, dinner: null },
        { day: 'vendredi', lunch: null, dinner: null },
        { day: 'samedi', lunch: null, dinner: null },
        { day: 'dimanche', lunch: null, dinner: null },
      ],
    }
    vi.mocked(loadUserContext).mockResolvedValueOnce({} as any)
    vi.mocked(generatePlan).mockResolvedValueOnce(allNullPlan as any)
    mockInsert([mockPlan])  // un seul insert pour weeklyPlans

    const res = await request(app)
      .post('/api/plans/generate')
      .set('Cookie', cookie)
      .send(validInput)

    expect(res.status).toBe(201)
    expect(res.body.entries).toHaveLength(0)
    // Un seul insert (weekly_plans), pas de second insert (meal_entries)
    expect(db.insert).toHaveBeenCalledTimes(1)
  })
})

// ─── GET /api/plans ────────────────────────────────────────────────────────────

describe('GET /api/plans', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/plans')
    expect(res.status).toBe(401)
  })

  it('renvoie la liste des plans du user', async () => {
    const mockList = [
      { id: 'plan-1', weekStartDate: '2025-05-12', status: 'draft', createdAt: new Date(), updatedAt: new Date() },
      { id: 'plan-2', weekStartDate: '2025-05-05', status: 'active', createdAt: new Date(), updatedAt: new Date() },
    ]
    vi.mocked(db.query.weeklyPlans.findMany).mockResolvedValueOnce(mockList as any)

    const res = await request(app).get('/api/plans').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.plans).toHaveLength(2)
  })
})

// ─── GET /api/plans/:id ────────────────────────────────────────────────────────

describe('GET /api/plans/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/plans/plan-1')
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si le plan n\'appartient pas au user', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app).get('/api/plans/plan-autre-user').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })

  it('renvoie le plan complet', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce(mockPlan as any)

    const res = await request(app).get('/api/plans/plan-1').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.plan.id).toBe('plan-1')
    expect(res.body.plan.outputJson).toBeDefined()
  })
})

// ─── POST /api/plans/:id/regenerate ───────────────────────────────────────────

describe('POST /api/plans/:id/regenerate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/plans/plan-1/regenerate').send({ feedback: 'Trop de viande' })
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si feedback est vide', async () => {
    const res = await request(app)
      .post('/api/plans/plan-1/regenerate')
      .set('Cookie', cookie)
      .send({ feedback: '' })
    expect(res.status).toBe(400)
  })

  it('renvoie 404 si le plan n\'appartient pas au user', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .post('/api/plans/plan-autre/regenerate')
      .set('Cookie', cookie)
      .send({ feedback: 'Trop de viande' })
    expect(res.status).toBe(404)
  })

  it('archive l\'ancien plan et cree le nouveau (201)', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce(mockPlan as any)
    vi.mocked(loadUserContext).mockResolvedValueOnce({} as any)
    vi.mocked(generatePlan).mockResolvedValueOnce(validPlanOutput as any)

    // db.update pour archiver l'ancien plan
    const updateWhere = vi.fn().mockResolvedValue([])
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    vi.mocked(db.update).mockReturnValueOnce({ set: updateSet } as any)

    // db.insert x2 : nouveau plan + entries
    const newPlan = { ...mockPlan, id: 'plan-new' }
    const returningNewPlan = vi.fn().mockResolvedValueOnce([newPlan])
    const valuesNewPlan = vi.fn().mockReturnValue({ returning: returningNewPlan })
    const returningEntries = vi.fn().mockResolvedValueOnce([
      { id: 'e-1', slot: 'lundi-midi', mealLabel: 'Salade poulet' },
      { id: 'e-2', slot: 'lundi-soir', mealLabel: 'Riz poulet' },
    ])
    const valuesEntries = vi.fn().mockReturnValue({ returning: returningEntries })
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: valuesNewPlan } as any)
      .mockReturnValueOnce({ values: valuesEntries } as any)

    const res = await request(app)
      .post('/api/plans/plan-1/regenerate')
      .set('Cookie', cookie)
      .send({ feedback: 'Moins de viande rouge, plus de légumes.' })

    expect(res.status).toBe(201)
    expect(res.body.plan.id).toBe('plan-new')
    expect(res.body.entries).toHaveLength(2)
    // Vérifie que generatePlan a été appelé avec le bon kind
    expect(generatePlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'user-1',
      'regenerate_with_feedback',
      expect.objectContaining({ feedback: 'Moins de viande rouge, plus de légumes.' }),
    )
    // Vérifie que l'ancien plan a été archivé
    expect(db.update).toHaveBeenCalledTimes(1)
  })
})

// ─── POST /api/plans/:id/finalize ─────────────────────────────────────────────

describe('POST /api/plans/:id/finalize', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/plans/plan-1/finalize')
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si le plan n\'appartient pas au user', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app).post('/api/plans/plan-autre/finalize').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })

  it('renvoie 409 si le plan est deja active', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce({ ...mockPlan, status: 'active' } as any)

    const res = await request(app).post('/api/plans/plan-1/finalize').set('Cookie', cookie)
    expect(res.status).toBe(409)
  })

  it('renvoie 409 si le plan est deja archive', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce({ ...mockPlan, status: 'archived' } as any)

    const res = await request(app).post('/api/plans/plan-1/finalize').set('Cookie', cookie)
    expect(res.status).toBe(409)
  })

  it('passe le plan de draft a active (200)', async () => {
    vi.mocked(db.query.weeklyPlans.findFirst).mockResolvedValueOnce(mockPlan as any)

    const activePlan = { ...mockPlan, status: 'active' }
    const returning = vi.fn().mockResolvedValueOnce([activePlan])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as any)

    const res = await request(app).post('/api/plans/plan-1/finalize').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.plan.status).toBe('active')
  })
})
