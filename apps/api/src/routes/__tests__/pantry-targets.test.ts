import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({
  db: {
    query: {
      pantryTargets: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '@/db'
import { createApp } from '@/app'
import { signToken } from '@/lib/auth'

const app = createApp()
const token = signToken({ sub: 'user-1', email: 'fx@test.com' })
const cookie = `auth_token=${token}`

const mockTarget = {
  id: 'pt-1',
  userId: 'user-1',
  name: 'Lentilles',
  category: 'legumineuses',
  targetQuantity: '2',
  unit: 'kg',
  rotationMonths: 3,
  priority: 'essentiel',
  preferredLocationId: null,
  notes: null,
  lastPurchasedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('GET /api/pantry-targets', () => {
  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/pantry-targets')
    expect(res.status).toBe(401)
  })

  it('renvoie la liste du user connecte', async () => {
    vi.mocked(db.query.pantryTargets.findMany).mockResolvedValueOnce([mockTarget] as any)

    const res = await request(app).get('/api/pantry-targets').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.targets).toHaveLength(1)
    expect(res.body.targets[0].name).toBe('Lentilles')
  })
})

describe('POST /api/pantry-targets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/pantry-targets').send({})
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si category est invalide', async () => {
    const res = await request(app)
      .post('/api/pantry-targets')
      .set('Cookie', cookie)
      .send({ name: 'Test', category: 'inconnue', targetQuantity: 1, unit: 'kg', priority: 'essentiel' })

    expect(res.status).toBe(400)
  })

  it('renvoie 400 si targetQuantity <= 0', async () => {
    const res = await request(app)
      .post('/api/pantry-targets')
      .set('Cookie', cookie)
      .send({ name: 'Test', category: 'cereales', targetQuantity: 0, unit: 'kg', priority: 'essentiel' })

    expect(res.status).toBe(400)
  })

  it('cree une cible (201)', async () => {
    const returning = vi.fn().mockResolvedValueOnce([mockTarget])
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any)

    const res = await request(app)
      .post('/api/pantry-targets')
      .set('Cookie', cookie)
      .send({ name: 'Lentilles', category: 'legumineuses', targetQuantity: 2, unit: 'kg', priority: 'essentiel' })

    expect(res.status).toBe(201)
    expect(res.body.target.userId).toBe('user-1')
  })
})

describe('POST /api/pantry-targets/bulk-init', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/pantry-targets/bulk-init').send({ targets: [] })
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si targets est vide', async () => {
    const res = await request(app)
      .post('/api/pantry-targets/bulk-init')
      .set('Cookie', cookie)
      .send({ targets: [] })

    expect(res.status).toBe(400)
  })

  it('cree plusieurs cibles en une requete (201)', async () => {
    const twoTargets = [mockTarget, { ...mockTarget, id: 'pt-2', name: 'Pois chiches' }]
    const returning = vi.fn().mockResolvedValueOnce(twoTargets)
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any)

    const payload = {
      targets: [
        { name: 'Lentilles', category: 'legumineuses', targetQuantity: 2, unit: 'kg', priority: 'essentiel' },
        { name: 'Pois chiches', category: 'legumineuses', targetQuantity: 1, unit: 'kg', priority: 'secondaire' },
      ],
    }

    const res = await request(app)
      .post('/api/pantry-targets/bulk-init')
      .set('Cookie', cookie)
      .send(payload)

    expect(res.status).toBe(201)
    expect(res.body.count).toBe(2)
  })
})

describe('PATCH /api/pantry-targets/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).patch('/api/pantry-targets/pt-1').send({ name: 'Nouveau' })
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si la cible appartient a un autre user', async () => {
    vi.mocked(db.query.pantryTargets.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .patch('/api/pantry-targets/pt-1')
      .set('Cookie', cookie)
      .send({ name: 'Nouveau' })

    expect(res.status).toBe(404)
  })

  it('met a jour la cible (200)', async () => {
    vi.mocked(db.query.pantryTargets.findFirst).mockResolvedValueOnce(mockTarget as any)

    const updated = { ...mockTarget, name: 'Lentilles vertes' }
    const returning = vi.fn().mockResolvedValueOnce([updated])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as any)

    const res = await request(app)
      .patch('/api/pantry-targets/pt-1')
      .set('Cookie', cookie)
      .send({ name: 'Lentilles vertes' })

    expect(res.status).toBe(200)
    expect(res.body.target.name).toBe('Lentilles vertes')
  })
})

describe('POST /api/pantry-targets/:id/restocked', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 404 si la cible n\'existe pas pour ce user', async () => {
    vi.mocked(db.query.pantryTargets.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .post('/api/pantry-targets/pt-999/restocked')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })

  it('met a jour lastPurchasedAt a aujourd\'hui (200)', async () => {
    vi.mocked(db.query.pantryTargets.findFirst).mockResolvedValueOnce(mockTarget as any)

    const today = new Date().toISOString().slice(0, 10)
    const restocked = { ...mockTarget, lastPurchasedAt: today }
    const returning = vi.fn().mockResolvedValueOnce([restocked])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    vi.mocked(db.update).mockReturnValueOnce({ set } as any)

    const res = await request(app)
      .post('/api/pantry-targets/pt-1/restocked')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.target.lastPurchasedAt).toBe(today)
  })
})

describe('DELETE /api/pantry-targets/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).delete('/api/pantry-targets/pt-1')
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si la cible appartient a un autre user', async () => {
    vi.mocked(db.query.pantryTargets.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .delete('/api/pantry-targets/pt-1')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })

  it('supprime la cible (200)', async () => {
    vi.mocked(db.query.pantryTargets.findFirst).mockResolvedValueOnce(mockTarget as any)

    const where = vi.fn().mockResolvedValueOnce(undefined)
    vi.mocked(db.delete).mockReturnValueOnce({ where } as any)

    const res = await request(app)
      .delete('/api/pantry-targets/pt-1')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
