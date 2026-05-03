import type { ErrorRequestHandler } from 'express'
import { AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// Signature à 4 arguments obligatoire pour qu'Express reconnaisse ce middleware comme
// un error handler (même si _next n'est pas utilisé).
export const errorHandler: ErrorRequestHandler = (err, req, _res, next) => {
  const res = _res

  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // Erreur inattendue : on logue tous les détails mais on ne les expose pas au client.
  logger.error(
    {
      err,
      req: { method: req.method, url: req.url },
    },
    'Erreur inattendue',
  )

  res.status(500).json({ error: 'Une erreur interne est survenue' })
}
