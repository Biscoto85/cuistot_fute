import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  // Hashé avec argon2 — jamais stocké en clair, jamais exposé dans les réponses API.
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  // 1 crédit = 1 génération de plan. 2 offerts à la création. Les admins ne consomment pas.
  credits: integer('credits').notNull().default(2),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // $onUpdateFn est appelé automatiquement par Drizzle lors d'un .update().
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
