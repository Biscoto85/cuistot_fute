import cookieParser from 'cookie-parser'
import cors from 'cors'
import { sql } from 'drizzle-orm'
import express from 'express'
import { db } from '@/db'
import { httpLogger } from '@/lib/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { requireAdmin } from '@/middleware/requireAdmin'
import { requireAuth } from '@/middleware/requireAuth'
import { adminRouter } from '@/routes/admin'
import { authRouter } from '@/routes/auth'
import { householdRouter } from '@/routes/household'
import { locationsRouter } from '@/routes/locations'
import { mealEntriesRouter } from '@/routes/meal-entries'
import { pantryTargetsRouter } from '@/routes/pantry-targets'
import { plansRouter } from '@/routes/plans'
import { ratingsRouter } from '@/routes/ratings'
import { preferencesRouter } from '@/routes/preferences'
import { usersRouter } from '@/routes/users'

export function createApp() {
  const app = express()

  // Nginx reverse proxy — nécessaire pour que express-rate-limit identifie correctement les IPs
  app.set('trust proxy', 1)

  app.use(httpLogger)
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  // ─── Routes publiques ───────────────────────────────────────────────────────
  app.use('/api/auth', authRouter)

  // ─── Routes protégées ───────────────────────────────────────────────────────
  app.use('/api/household', requireAuth, householdRouter)
  app.use('/api/locations', requireAuth, locationsRouter)
  app.use('/api/preferences', requireAuth, preferencesRouter)
  app.use('/api/pantry-targets', requireAuth, pantryTargetsRouter)
  app.use('/api/plans', requireAuth, plansRouter)
  app.use('/api/meal-entries', requireAuth, mealEntriesRouter)
  app.use('/api/ratings', requireAuth, ratingsRouter)
  app.use('/api/users', requireAuth, usersRouter)
  app.use('/api/admin', requireAuth, requireAdmin, adminRouter)

  // ─── Healthcheck ────────────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    try {
      await db.execute(sql`SELECT 1`)
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    } catch {
      res.status(503).json({ status: 'error', timestamp: new Date().toISOString() })
    }
  })

  // ─── Error handler (doit être le dernier middleware) ────────────────────────
  app.use(errorHandler)

  return app
}
