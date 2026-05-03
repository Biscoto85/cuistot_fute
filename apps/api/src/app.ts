import cookieParser from 'cookie-parser'
import cors from 'cors'
import { sql } from 'drizzle-orm'
import express from 'express'
import { db } from '@/db'
import { httpLogger } from '@/lib/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { requireAuth } from '@/middleware/requireAuth'
import { authRouter } from '@/routes/auth'
import { householdRouter } from '@/routes/household'
import { locationsRouter } from '@/routes/locations'
import { pantryTargetsRouter } from '@/routes/pantry-targets'
import { preferencesRouter } from '@/routes/preferences'

export function createApp() {
  const app = express()

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
