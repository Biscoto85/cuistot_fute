import pino from 'pino'

// En développement, pino-pretty formate les logs en console lisible.
// En prod, on reste en JSON structuré pour faciliter l'ingestion par les outils de monitoring.
export const logger = pino(
  process.env.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
)
