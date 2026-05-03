import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { httpLogger, logger } from '@/lib/logger'
import { errorHandler } from '@/middleware/errorHandler'
import { authRouter } from '@/routes/auth'

// ─── Validation des variables d'environnement requises ───────────────────────

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.fatal({ key }, `Variable d'environnement manquante : ${key}`)
    process.exit(1)
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3003
const app = express()

app.use(httpLogger)
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// ─── Routes publiques ─────────────────────────────────────────────────────────

app.use('/api/auth', authRouter)

// ─── Healthcheck ──────────────────────────────────────────────────────────────

// Ping DB inclus : PM2 et les sondes de monitoring peuvent détecter une panne DB.
app.get('/api/health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`)
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() })
  }
})

// ─── Routes protégées (ajoutées à partir de T6) ───────────────────────────────
// app.use('/api', requireAuth, ...)

// ─── Error handler global (doit être le dernier middleware) ───────────────────

app.use(errorHandler)

// ─── Démarrage ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API démarrée')
})
