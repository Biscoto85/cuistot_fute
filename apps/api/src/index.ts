import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'

// Import en side-effect : lève une exception au boot si DATABASE_URL ou JWT_SECRET manquent.
import '@/db'
import { logger } from '@/lib/logger'
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

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,  // nécessaire pour que le cookie JWT soit transmis cross-origin
}))
app.use(express.json())
app.use(cookieParser())

// ─── Routes publiques (pas de requireAuth) ────────────────────────────────────

app.use('/api/auth', authRouter)

// ─── Endpoint de santé ────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Routes protégées ajoutées au fil des tâches (T6+) ───────────────────────
// app.use('/api', requireAuth, ...)

// ─── Démarrage ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API démarrée')
})
