import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({
  db: {
    query: {
      userPreferences: { findFirst: vi.fn() },
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

describe('GET /api/preferences', () => {
  it('renvoie 401 sans auth', async () => {
    const res = await request(app).get('/api/preferences')
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si les preferences n\'existent pas', async () => {
    vi.mocked(db.query.userPreferences.findFirst).mockResolvedValueOnce(undefined)

    const res = await request(app).get('/api/preferences').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renvoie 401 sans auth', async () => {
    const res = await request(app).put('/api/preferences').send({ loves: ['poulet'] })
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si allergies contient une chaine vide', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set('Cookie', cookie)
      .send({ allergies: [''] }) // min(1) sur chaque item

    expect(res.status).toBe(400)
  })

  it('cree les preferences (201) si elles n\'existent pas', async () => {
    vi.mocked(db.query.userPreferences.findFirst).mockResolvedValueOnce(undefined)

    const mockPrefs = { id: 'pref-1', userId: 'user-1', loves: ['poulet'], allergies: [] }
    const returning = vi.fn().mockResolvedValueOnce([mockPrefs])
    const values = vi.fn().mockReturnValue({ returning })
    vi.mocked(db.insert).mockReturnValueOnce({ values } as any)

    const res = await request(app)
      .put('/api/preferences')
      .set('Cookie', cookie)
      .send({ loves: ['poulet'] })

    expect(res.status).toBe(201)
    expect(res.body.preferences.userId).toBe('user-1')
  })
})
