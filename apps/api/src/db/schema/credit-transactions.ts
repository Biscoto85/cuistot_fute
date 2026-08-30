import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

// Journal des mouvements de crédits — audit et base pour la facturation (Stripe/PayPlug à venir).
export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Négatif = consommation, positif = recharge (admin ou paiement)
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CreditTransaction = typeof creditTransactions.$inferSelect
export type NewCreditTransaction = typeof creditTransactions.$inferInsert
