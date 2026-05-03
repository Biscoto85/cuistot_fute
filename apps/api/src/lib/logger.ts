import pinoHttp from 'pino-http'

const isDev = process.env.NODE_ENV !== 'production'

// pino-http crée le logger Pino en interne et l'expose via .logger.
// On réexporte ce logger pour l'utiliser partout (logs applicatifs, errorHandler…).
// En développement, pino-pretty formate les logs en console lisible.
// En prod, JSON structuré pour l'ingestion par les outils de monitoring.
export const httpLogger = pinoHttp(
  isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {
        // Masque les cookies (JWT) et les tokens d'autorisation dans les logs prod.
        redact: ['req.headers.cookie', 'req.headers.authorization'],
        customLogLevel(_req, res) {
          if (res.statusCode >= 500) return 'error'
          if (res.statusCode >= 400) return 'warn'
          return 'info'
        },
      },
)

export const logger = httpLogger.logger
