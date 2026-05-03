import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { MealEntryUpdateSchema } from '@cuistot/shared'
import { db } from '@/db'
import { mealEntries } from '@/db/schema'
import type { NewMealEntry } from '@/db/schema'
import { BadRequestError, NotFoundError } from '@/lib/errors'

export const mealEntriesRouter = Router()

// GET /api/meal-entries/favorites — repas marqués favoris (max 50, du plus récent)
// Doit être déclaré avant /:id pour ne pas être capturé par le paramètre dynamique.
mealEntriesRouter.get('/favorites', async (req, res) => {
  const entries = await db.query.mealEntries.findMany({
    where: and(eq(mealEntries.userId, req.user.id), eq(mealEntries.isFavorite, true)),
    orderBy: (t, { desc }) => desc(t.createdAt),
    limit: 50,
  })
  res.json({ entries })
})

// PATCH /api/meal-entries/:id — toggle is_favorite et/ou enregistrer eaten_at
mealEntriesRouter.patch('/:id', async (req, res) => {
  const parsed = MealEntryUpdateSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')

  const entry = await db.query.mealEntries.findFirst({
    where: and(eq(mealEntries.id, req.params.id), eq(mealEntries.userId, req.user.id)),
  })
  if (!entry) throw new NotFoundError('Repas introuvable')

  // Construire l'objet de mise à jour avec les champs fournis uniquement
  const updateData: Partial<Pick<NewMealEntry, 'isFavorite' | 'eatenAt'>> = {}
  if (parsed.data.is_favorite !== undefined) updateData.isFavorite = parsed.data.is_favorite
  if ('eaten_at' in parsed.data) updateData.eatenAt = parsed.data.eaten_at ?? null

  if (Object.keys(updateData).length === 0) {
    return res.json({ entry })
  }

  const [updated] = await db
    .update(mealEntries)
    .set(updateData)
    .where(eq(mealEntries.id, entry.id))
    .returning()

  res.json({ entry: updated })
})
