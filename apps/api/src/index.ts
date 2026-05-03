import 'dotenv/config'
import { createApp } from '@/app'
import { logger } from '@/lib/logger'

// ─── Validation des variables d'environnement requises ───────────────────────

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.fatal({ key }, `Variable d'environnement manquante : ${key}`)
    process.exit(1)
  }
}

// ─── Démarrage ────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3003
const app = createApp()

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API démarrée')
})
