import 'dotenv/config'
import express from 'express'
import { logger } from '@/lib/logger'

const PORT = Number(process.env.PORT) || 3003
const app = express()

app.use(express.json())

// Endpoint de santé — utilisé par PM2 et le monitoring pour vérifier que l'API tourne.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API démarrée')
})
