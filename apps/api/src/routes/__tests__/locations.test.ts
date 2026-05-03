import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({
  db: {
    query: {
      userLocations: { findFirst: vi.fn(), findMany: vi.fn() },
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
const tokenA = signToken({ sub: 'user-a', email: 'a@test.com' })
const tokenB = signToken({ sub: 'user-b', email: 'b@test.com' })
const cookieA = `auth_token=${tokenA}`
const cookieB = `auth_token=${tokenB}`

describe('GET /api/locations', () => {
  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/locations')
    expect(res.status).toBe(401)
  })

  it('renvoie la liste (vide) du user connecté', async () => {
    vi.mocked(db.query.userLocations.findMany).mockResolvedValueOnce([])

    const res = await request(app).get('/api/locations').set('Cookie', cookieA)

    expect(res.status).toBe(200)
    expect(res.body.locations).toEqual([])
  })
})

describe('POST /api/locations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).post('/api/locations').send({ name: 'X', kind: 'bio' })
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si kind est invalide', async () => {
    const res = await request(app)
      .post('/api/locations')
      .set('Cookie', cookieA)
      .send({ name: 'X', kind: 'superette' }) // valeur hors enum

    expect(res.status).toBe(400)
  })

  it('crée un lieu pour le user connecté', async () => {
    const mockLoc = { id: 'loc-1', userId: 'user-a', name: 'Biocoop', kind: 'bio' }
    const returning = vi.fn().mockResolvedValueOnce([mockLoc])
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any)

    const res = await request(app)
      .post('/api/locations')
      .set('Cookie', cookieA)
      .send({ name: 'Biocoop', kind: 'bio' })

    expect(res.status).toBe(201)
    expect(res.body.location.userId).toBe('user-a')
  })
})

describe('DELETE /api/locations/:id — isolation', () => {
  it('renvoie 404 si le lieu appartient à un autre user', async () => {
    // user-b essaie de supprimer un lieu de user-a → findFirst renvoie null
    // (la requête filtre sur userId = user-b mais le lieu appartient à user-a)
    vi.mocked(db.query.userLocations.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .delete('/api/locations/loc-uuid-from-user-a')
      .set('Cookie', cookieB)

    expect(res.status).toBe(404)
  })
})
