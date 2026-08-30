import { and, asc, eq } from 'drizzle-orm'
import { Router } from 'express'
import {
  PantryBulkInitSchema,
  PantryTargetCreateSchema,
  PantryTargetUpdateSchema,
} from '@cuistot/shared'
import { db } from '@/db'
import { pantryTargets } from '@/db/schema'
import { BadRequestError, NotFoundError } from '@/lib/errors'

export const pantryTargetsRouter = Router()

// GET /api/pantry-targets — liste complète du user, essentiels en premier
pantryTargetsRouter.get('/', async (req, res) => {
  const targets = await db.query.pantryTargets.findMany({
    where: eq(pantryTargets.userId, req.user.id),
    orderBy: [asc(pantryTargets.priority), asc(pantryTargets.name)],
  })
  res.json({ targets })
})

// POST /api/pantry-targets
pantryTargetsRouter.post('/', async (req, res) => {
  const parsed = PantryTargetCreateSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')

  const [target] = await db
    .insert(pantryTargets)
    .values({ userId: req.user.id, ...parsed.data, targetQuantity: String(parsed.data.targetQuantity) })
    .returning()

  res.status(201).json({ target })
})

// POST /api/pantry-targets/bulk-init — onboarding : création en masse (avant /:id)
pantryTargetsRouter.post('/bulk-init', async (req, res) => {
  const parsed = PantryBulkInitSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')

  const rows = parsed.data.targets.map((t) => ({
    userId: req.user.id,
    ...t,
    targetQuantity: String(t.targetQuantity),
  }))

  const inserted = await db.insert(pantryTargets).values(rows).returning()

  res.status(201).json({ targets: inserted, count: inserted.length })
})

// PATCH /api/pantry-targets/:id
pantryTargetsRouter.patch('/:id', async (req, res) => {
  const parsed = PantryTargetUpdateSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')

  const existing = await db.query.pantryTargets.findFirst({
    where: and(eq(pantryTargets.id, req.params.id), eq(pantryTargets.userId, req.user.id)),
  })
  if (!existing) throw new NotFoundError('Cible garde-manger introuvable')

  const { targetQuantity, ...rest } = parsed.data
  const updateData = {
    ...rest,
    ...(targetQuantity !== undefined && { targetQuantity: String(targetQuantity) }),
  }

  const [updated] = await db
    .update(pantryTargets)
    .set(updateData)
    .where(eq(pantryTargets.id, existing.id))
    .returning()

  res.json({ target: updated })
})

// POST /api/pantry-targets/:id/restocked — raccourci : last_purchased_at = aujourd'hui
pantryTargetsRouter.post('/:id/restocked', async (req, res) => {
  const existing = await db.query.pantryTargets.findFirst({
    where: and(eq(pantryTargets.id, req.params.id), eq(pantryTargets.userId, req.user.id)),
  })
  if (!existing) throw new NotFoundError('Cible garde-manger introuvable')

  const today = new Date().toISOString().slice(0, 10)

  // Réappro = date d'achat mise à jour ET stock repassé à 'ok'
  const [updated] = await db
    .update(pantryTargets)
    .set({ lastPurchasedAt: today, stockStatus: 'ok' })
    .where(eq(pantryTargets.id, existing.id))
    .returning()

  res.json({ target: updated })
})

// DELETE /api/pantry-targets/:id
pantryTargetsRouter.delete('/:id', async (req, res) => {
  const existing = await db.query.pantryTargets.findFirst({
    where: and(eq(pantryTargets.id, req.params.id), eq(pantryTargets.userId, req.user.id)),
  })
  if (!existing) throw new NotFoundError('Cible garde-manger introuvable')

  await db.delete(pantryTargets).where(eq(pantryTargets.id, existing.id))

  res.json({ ok: true })
})
