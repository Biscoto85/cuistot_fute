import type { NextFunction, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

// À monter APRÈS requireAuth. Le statut admin est lu en DB à chaque requête
// (et non depuis le JWT) pour qu'une révocation soit effective immédiatement.
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.user.id),
    columns: { isAdmin: true },
  })

  if (!user?.isAdmin) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' })
    return
  }

  next()
}
