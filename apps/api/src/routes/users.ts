import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '@/db'
import {
  users, households, userLocations, userPreferences,
  pantryTargets, weeklyPlans, mealEntries, mealRatings, llmLogs,
} from '@/db/schema'
import { verifyPassword, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth'
import { requireAuth } from '@/middleware/requireAuth'
import { BadRequestError } from '@/lib/errors'

export const usersRouter = Router()

const DeleteAccountSchema = { parse: (body: unknown) => {
  if (!body || typeof body !== 'object' || !('password' in body) || typeof (body as { password: unknown }).password !== 'string' || !(body as { password: string }).password) {
    throw new BadRequestError('Mot de passe requis')
  }
  return body as { password: string }
} }

// ─── GET /api/users/me/export — export RGPD complet ──────────────────────────

usersRouter.get('/me/export', requireAuth, async (req, res) => {
  const uid = req.user.id

  const [
    user,
    household,
    locations,
    preferences,
    pantry,
    plans,
    entries,
    ratings,
  ] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, uid) }),
    db.query.households.findFirst({ where: eq(households.userId, uid) }),
    db.query.userLocations.findMany({ where: eq(userLocations.userId, uid) }),
    db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, uid) }),
    db.query.pantryTargets.findMany({ where: eq(pantryTargets.userId, uid) }),
    db.query.weeklyPlans.findMany({ where: eq(weeklyPlans.userId, uid) }),
    db.query.mealEntries.findMany({ where: eq(mealEntries.userId, uid) }),
    db.query.mealRatings.findMany({ where: eq(mealRatings.userId, uid) }),
  ])

  const { passwordHash: _omit, ...safeUser } = user!

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: safeUser,
    household,
    locations,
    preferences,
    pantryTargets: pantry,
    weeklyPlans: plans,
    mealEntries: entries,
    mealRatings: ratings,
  }

  res.setHeader('Content-Disposition', `attachment; filename="cuistot-export-${uid.slice(0, 8)}.json"`)
  res.setHeader('Content-Type', 'application/json')
  res.json(exportData)
})

// ─── DELETE /api/users/me — suppression compte (confirmation mot de passe) ────

usersRouter.delete('/me', requireAuth, async (req, res) => {
  const parsed = DeleteAccountSchema.parse(req.body)

  const user = await db.query.users.findFirst({ where: eq(users.id, req.user.id) })
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' })
    return
  }

  const valid = await verifyPassword(parsed.password, user.passwordHash)
  if (!valid) throw new BadRequestError('Mot de passe incorrect')

  // ON DELETE CASCADE supprime toutes les données liées
  await db.delete(users).where(eq(users.id, user.id))

  // Effacer le cookie JWT
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)
  res.json({ message: 'Compte supprimé' })
})
