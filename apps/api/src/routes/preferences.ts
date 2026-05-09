import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { PreferencesUpdateSchema } from '@cuistot/shared'
import { db } from '@/db'
import { userPreferences } from '@/db/schema'
import { BadRequestError } from '@/lib/errors'

export const preferencesRouter = Router()

// GET /api/preferences
// Retourne les préférences du user. 404 si l'onboarding étape 3 n'a pas été faite.
preferencesRouter.get('/', async (req, res) => {
  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, req.user.id),
  })
  if (!prefs) {
    res.status(404).json({ error: 'Préférences non configurées' })
    return
  }
  res.json({ preferences: prefs })
})

// PUT /api/preferences — upsert
preferencesRouter.put('/', async (req, res) => {
  const parsed = PreferencesUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new BadRequestError('Données invalides')
  }

  // Mapping snake_case API → camelCase Drizzle
  const {
    loves,
    dislikes,
    allergies,
    current_phase: currentPhase,
    dietary_targets: dietaryTargets,
    cooking_complexity: cookingComplexity,
    local_specialties: localSpecialties,
    notes,
  } = parsed.data

  const dbFields = { loves, dislikes, allergies, currentPhase, cookingComplexity, dietaryTargets, localSpecialties, notes }

  const existing = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, req.user.id),
  })

  if (existing) {
    const [updated] = await db
      .update(userPreferences)
      .set(dbFields)
      .where(eq(userPreferences.id, existing.id))
      .returning()
    res.json({ preferences: updated })
  } else {
    const [created] = await db
      .insert(userPreferences)
      .values({ userId: req.user.id, ...dbFields })
      .returning()
    res.status(201).json({ preferences: created })
  }
})
