import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @/db avant tout import qui en depend.
vi.mock('@/db', () => ({
  db: {
    query: {
      households: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

import { db } from '@/db'
import { createApp } from '@/app'
import { signToken } from '@/lib/auth'

const app = createApp()
const validToken = signToken({ sub: 'user-uuid-1', email: 'fx@test.com' })
const authCookie = `auth_token=${validToken}`

describe('GET /api/household', () => {
  it('renvoie 401 sans cookie d\'auth', async () => {
    const res = await request(app).get('/api/household')
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si le foyer n\'existe pas encore', async () => {
    vi.mocked(db.query.households.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app)
      .get('/api/household')
      .set('Cookie', authCookie)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('renvoie le foyer existant', async () => {
    const mockHousehold = { id: 'hh-1', userId: 'user-uuid-1', adults: 2, children: 0 }
    vi.mocked(db.query.households.findFirst).mockResolvedValueOnce(mockHousehold as any)

    const res = await request(app)
      .get('/api/household')
      .set('Cookie', authCookie)

    expect(res.status).toBe(200)
    expect(res.body.household).toMatchObject({ id: 'hh-1' })
  })
})

describe('PUT /api/household', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans cookie d\'auth', async () => {
    const res = await request(app).put('/api/household').send({ adults: 2 })
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si adults < 1', async () => {
    const res = await request(app)
      .put('/api/household')
      .set('Cookie', authCookie)
      .send({ adults: 0 })

    expect(res.status).toBe(400)
  })

  it('cree le foyer (201) s\'il n\'existe pas', async () => {
    vi.mocked(db.query.households.findFirst).mockResolvedValueOnce(undefined)

    const insertReturning = vi.fn().mockResolvedValueOnce([{ id: 'hh-new', adults: 2 }])
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning })
    vi.mocked(db.insert).mockReturnValueOnce({ values: insertValues } as any)

    const res = await request(app)
      .put('/api/household')
      .set('Cookie', authCookie)
      .send({ adults: 2, children: 1 })

    expect(res.status).toBe(201)
    expect(res.body.household).toMatchObject({ id: 'hh-new' })
  })
})
