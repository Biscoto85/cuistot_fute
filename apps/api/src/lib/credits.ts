import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { creditTransactions, users } from '@/db/schema'
import { logger } from '@/lib/logger'

// Consomme 1 crédit et journalise le mouvement.
// Le guard credits >= 1 évite de passer en négatif en cas de requêtes concurrentes ;
// si le guard échoue (course rarissime : le crédit a déjà été vérifié en début de
// handler), on ne bloque pas la réponse — le plan est déjà généré et payé en tokens.
export async function consumeCredit(userId: string, reason: string): Promise<void> {
  const [updated] = await db
    .update(users)
    .set({ credits: sql`${users.credits} - 1` })
    .where(and(eq(users.id, userId), gte(users.credits, 1)))
    .returning({ credits: users.credits })

  if (!updated) {
    logger.warn({ userId, reason }, 'credits: décompte impossible (solde déjà à 0)')
    return
  }

  await db.insert(creditTransactions).values({
    userId,
    delta: -1,
    reason,
    balanceAfter: updated.credits,
  })
}

// Ajustement par un admin (positif ou négatif). Retourne le nouveau solde.
export async function adjustCredits(
  userId: string,
  delta: number,
  reason: string,
): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ credits: sql`GREATEST(${users.credits} + ${delta}, 0)` })
    .where(eq(users.id, userId))
    .returning({ credits: users.credits })

  if (!updated) throw new Error(`Utilisateur ${userId} introuvable`)

  await db.insert(creditTransactions).values({
    userId,
    delta,
    reason,
    balanceAfter: updated.credits,
  })

  return updated.credits
}
