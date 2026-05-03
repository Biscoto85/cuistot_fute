import type { NextFunction, Request, Response } from 'express'
import { COOKIE_NAME, verifyToken } from '@/lib/auth'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[COOKIE_NAME]

  if (!token) {
    res.status(401).json({ error: 'Non authentifié' })
    return
  }

  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch {
    // Token expiré ou signature invalide — on renvoie une réponse générique
    // pour ne pas donner d'info sur la raison de l'échec.
    res.status(401).json({ error: 'Session invalide ou expirée' })
  }
}
