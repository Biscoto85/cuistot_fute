import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { HouseholdUpdateSchema } from '@cuistot/shared'
import { db } from '@/db'
import { households } from '@/db/schema'
import { BadRequestError } from '@/lib/errors'

export const householdRouter = Router()

// GET /api/household
// Retourne le foyer du user connecté. 404 si l'onboarding n'a pas encore été fait.
householdRouter.get('/', async (req, res) => {
  const household = await db.query.households.findFirst({
    where: eq(households.userId, req.user.id),
  })
  if (!household) {
    res.status(404).json({ error: 'Foyer non configuré' })
    return
  }
  res.json({ household })
})

// PUT /api/household
// Upsert : crée le foyer si inexistant, le met à jour sinon.
householdRouter.put('/', async (req, res) => {
  const parsed = HouseholdUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new BadRequestError('Données invalides')
  }

  const { adults, children, description } = parsed.data

  const existing = await db.query.households.findFirst({
    where: eq(households.userId, req.user.id),
  })

  if (existing) {
    const [updated] = await db
      .update(households)
      .set({ adults, children, description })
      .where(eq(households.id, existing.id))
      .returning()
    res.json({ household: updated })
  } else {
    const [created] = await db
      .insert(households)
      .values({ userId: req.user.id, adults, children, description })
      .returning()
    res.status(201).json({ household: created })
  }
})
