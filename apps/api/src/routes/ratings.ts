import { and, eq, inArray } from 'drizzle-orm'
import { Router } from 'express'
import { RatingsBatchSchema } from '@cuistot/shared'
import { db } from '@/db'
import { mealEntries, mealRatings } from '@/db/schema'
import { BadRequestError } from '@/lib/errors'

export const ratingsRouter = Router()

// POST /api/ratings — notation en lot (modale de fin de semaine)
// Chaque item référence un meal_entry_id qui doit appartenir au user.
ratingsRouter.post('/', async (req, res) => {
  const parsed = RatingsBatchSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')
  const userId = req.user.id

  // Vérifier que les entries existent et appartiennent au user
  const entryIds = parsed.data.map((r) => r.meal_entry_id)
  const userEntries = await db.query.mealEntries.findMany({
    where: and(inArray(mealEntries.id, entryIds), eq(mealEntries.userId, userId)),
    columns: { id: true, mealLabel: true },
  })

  if (userEntries.length === 0) throw new BadRequestError('Aucun repas valide à noter')

  const validMap = new Map(userEntries.map((e) => [e.id, e.mealLabel]))

  const rows = parsed.data
    .filter((r) => validMap.has(r.meal_entry_id))
    .map((r) => ({
      userId,
      mealEntryId: r.meal_entry_id,
      mealLabel: validMap.get(r.meal_entry_id)!,
      rating: r.rating,
      comment: r.comment ?? null,
    }))

  const created = await db.insert(mealRatings).values(rows).returning()
  res.status(201).json({ ratings: created, count: created.length })
})

// GET /api/ratings/recent — 50 dernières notations du user
ratingsRouter.get('/recent', async (req, res) => {
  const ratings = await db.query.mealRatings.findMany({
    where: eq(mealRatings.userId, req.user.id),
    orderBy: (t, { desc }) => desc(t.ratedAt),
    limit: 50,
  })
  res.json({ ratings })
})
