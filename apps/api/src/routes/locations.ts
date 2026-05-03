import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { LocationCreateSchema, LocationUpdateSchema } from '@cuistot/shared'
import { db } from '@/db'
import { userLocations } from '@/db/schema'
import { BadRequestError, NotFoundError } from '@/lib/errors'

export const locationsRouter = Router()

// GET /api/locations — liste triée par priorité
locationsRouter.get('/', async (req, res) => {
  const locations = await db.query.userLocations.findMany({
    where: eq(userLocations.userId, req.user.id),
    orderBy: (t, { asc }) => asc(t.priority),
  })
  res.json({ locations })
})

// POST /api/locations
locationsRouter.post('/', async (req, res) => {
  const parsed = LocationCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new BadRequestError('Données invalides')
  }

  const [location] = await db
    .insert(userLocations)
    .values({ userId: req.user.id, ...parsed.data })
    .returning()

  res.status(201).json({ location })
})

// PUT /api/locations/:id
locationsRouter.put('/:id', async (req, res) => {
  const parsed = LocationUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new BadRequestError('Données invalides')
  }

  // La double condition userId + id garantit qu'un user ne peut pas modifier
  // les lieux d'un autre user même en connaissant l'UUID.
  const existing = await db.query.userLocations.findFirst({
    where: and(eq(userLocations.id, req.params.id), eq(userLocations.userId, req.user.id)),
  })
  if (!existing) throw new NotFoundError('Lieu introuvable')

  const [updated] = await db
    .update(userLocations)
    .set(parsed.data)
    .where(eq(userLocations.id, existing.id))
    .returning()

  res.json({ location: updated })
})

// DELETE /api/locations/:id
locationsRouter.delete('/:id', async (req, res) => {
  const existing = await db.query.userLocations.findFirst({
    where: and(eq(userLocations.id, req.params.id), eq(userLocations.userId, req.user.id)),
  })
  if (!existing) throw new NotFoundError('Lieu introuvable')

  await db.delete(userLocations).where(eq(userLocations.id, existing.id))

  res.json({ ok: true })
})

// POST /api/locations/suggest — implémenté en T9 (requiert le module LLM)
locationsRouter.post('/suggest', (_req, res) => {
  res.status(501).json({ error: 'Non implémenté — disponible en T9' })
})
