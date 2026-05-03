import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({
  db: {
    query: {
      mealEntries: { findFirst: vi.fn(), findMany: vi.fn() },
      mealRatings: { findMany: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '@/db'
import { createApp } from '@/app'
import { signToken } from '@/lib/auth'

const app = createApp()
const token = signToken({ sub: 'user-1', email: 'fx@test.com' })
const cookie = `auth_token=${token}`

const mockEntry = {
  id: 'entry-1',
  userId: 'user-1',
  planId: 'plan-1',
  slot: 'lundi-midi',
  mealLabel: 'Salade poulet',
  mealDataJson: null,
  isFavorite: false,
  eatenAt: null,
  createdAt: new Date().toISOString(),
}

// ─── GET /api/meal-entries/favorites ─────────────────────────────────────────

describe('GET /api/meal-entries/favorites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/meal-entries/favorites')
    expect(res.status).toBe(401)
  })

  it('renvoie les favoris du user', async () => {
    const favs = [{ ...mockEntry, isFavorite: true }, { ...mockEntry, id: 'entry-2', mealLabel: 'Poulet rôti', isFavorite: true }]
    vi.mocked(db.query.mealEntries.findMany).mockResolvedValueOnce(favs as any)

    const res = await request(app).get('/api/meal-entries/favorites').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries[0].isFavorite).toBe(true)
  })

  it('renvoie une liste vide si aucun favori', async () => {
    vi.mocked(db.query.mealEntries.findMany).mockResolvedValueOnce([])

    const res = await request(app).get('/api/meal-entries/favorites').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(0)
  })
})

// ─── PATCH /api/meal-entries/:id ──────────────────────────────────────────────

describe('PATCH /api/meal-entries/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).patch('/api/meal-entries/entry-1').send({ is_favorite: true })
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si le repas appartient a un autre user', async () => {
    vi.mocked(db.query.mealEntries.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .patch('/api/meal-entries/entry-autre')
      .set('Cookie', cookie)
      .send({ is_favorite: true })

    expect(res.status).toBe(404)
  })

  it('renvoie 400 si eaten_at est mal formatee', async () => {
    const res = await request(app)
      .patch('/api/meal-entries/entry-1')
      .set('Cookie', cookie)
      .send({ eaten_at: '12/05/2025' })

    expect(res.status).toBe(400)
  })

  it('met a jour is_favorite (200)', async () => {
    vi.mocked(db.query.mealEntries.findFirst).mockResolvedValueOnce(mockEntry as any)

    const updated = { ...mockEntry, isFavorite: true }
    const returning = vi.fn().mockResolvedValueOnce([updated])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as any)

    const res = await request(app)
      .patch('/api/meal-entries/entry-1')
      .set('Cookie', cookie)
      .send({ is_favorite: true })

    expect(res.status).toBe(200)
    expect(res.body.entry.isFavorite).toBe(true)
  })

  it('met a jour eaten_at (200)', async () => {
    vi.mocked(db.query.mealEntries.findFirst).mockResolvedValueOnce(mockEntry as any)

    const updated = { ...mockEntry, eatenAt: '2025-05-12' }
    const returning = vi.fn().mockResolvedValueOnce([updated])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as any)

    const res = await request(app)
      .patch('/api/meal-entries/entry-1')
      .set('Cookie', cookie)
      .send({ eaten_at: '2025-05-12' })

    expect(res.status).toBe(200)
    expect(res.body.entry.eatenAt).toBe('2025-05-12')
  })

  it('renvoie le repas inchange si body vide (200)', async () => {
    vi.mocked(db.query.mealEntries.findFirst).mockResolvedValueOnce(mockEntry as any)

    const res = await request(app)
      .patch('/api/meal-entries/entry-1')
      .set('Cookie', cookie)
      .send({})

    expect(res.status).toBe(200)
    expect(res.body.entry.id).toBe('entry-1')
    expect(db.update).not.toHaveBeenCalled()
  })
})

// ─── POST /api/ratings ────────────────────────────────────────────────────────

describe('POST /api/ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/ratings').send([{ meal_entry_id: '11111111-1111-1111-1111-111111111111', rating: 1 }])
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si le corps n\'est pas un tableau', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', cookie)
      .send({ meal_entry_id: '11111111-1111-1111-1111-111111111111', rating: 1 })

    expect(res.status).toBe(400)
  })

  it('renvoie 400 si rating est hors valeurs (-1/0/1)', async () => {
    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', cookie)
      .send([{ meal_entry_id: '11111111-1111-1111-1111-111111111111', rating: 5 }])

    expect(res.status).toBe(400)
  })

  it('renvoie 400 si aucune entry n\'appartient au user', async () => {
    vi.mocked(db.query.mealEntries.findMany).mockResolvedValueOnce([])

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', cookie)
      .send([{ meal_entry_id: '11111111-1111-1111-1111-111111111111', rating: 1 }])

    expect(res.status).toBe(400)
  })

  it('cree les notations pour les entries valides (201)', async () => {
    const ENTRY_UUID = '11111111-1111-1111-1111-111111111111'
    vi.mocked(db.query.mealEntries.findMany).mockResolvedValueOnce([
      { id: ENTRY_UUID, mealLabel: 'Salade poulet' },
    ] as any)

    const mockRating = { id: 'rating-1', userId: 'user-1', mealEntryId: ENTRY_UUID, mealLabel: 'Salade poulet', rating: 1, comment: 'Délicieux', ratedAt: new Date() }
    const returning = vi.fn().mockResolvedValueOnce([mockRating])
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any)

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', cookie)
      .send([{ meal_entry_id: ENTRY_UUID, rating: 1, comment: 'Délicieux' }])

    expect(res.status).toBe(201)
    expect(res.body.count).toBe(1)
    expect(res.body.ratings[0].rating).toBe(1)
  })

  it('ignore les entries qui n\'appartiennent pas au user (ne plante pas)', async () => {
    const VALID_UUID = '11111111-1111-1111-1111-111111111111'
    const INVALID_UUID = '22222222-2222-2222-2222-222222222222'

    // Seul VALID_UUID est retourné (INVALID_UUID appartient à un autre user)
    vi.mocked(db.query.mealEntries.findMany).mockResolvedValueOnce([
      { id: VALID_UUID, mealLabel: 'Salade poulet' },
    ] as any)

    const returning = vi.fn().mockResolvedValueOnce([
      { id: 'rating-1', mealEntryId: VALID_UUID, rating: 0 },
    ])
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any)

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', cookie)
      .send([
        { meal_entry_id: VALID_UUID, rating: 0 },
        { meal_entry_id: INVALID_UUID, rating: 1 },  // sera ignoré
      ])

    expect(res.status).toBe(201)
    expect(res.body.count).toBe(1)
  })
})

// ─── GET /api/ratings/recent ──────────────────────────────────────────────────

describe('GET /api/ratings/recent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/ratings/recent')
    expect(res.status).toBe(401)
  })

  it('renvoie les notations recentes du user', async () => {
    const mockRatings = [
      { id: 'r-1', mealLabel: 'Salade poulet', rating: 1, ratedAt: new Date() },
      { id: 'r-2', mealLabel: 'Pasta carbonara', rating: -1, ratedAt: new Date() },
    ]
    vi.mocked(db.query.mealRatings.findMany).mockResolvedValueOnce(mockRatings as any)

    const res = await request(app).get('/api/ratings/recent').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ratings).toHaveLength(2)
    expect(res.body.ratings[0].rating).toBe(1)
  })
})
