import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  loves: jsonb('loves').$type<string[]>().notNull().default([]),
  dislikes: jsonb('dislikes').$type<string[]>().notNull().default([]),
  // allergies est STRICT : le LLM ne doit jamais en dévier, contrairement aux dislikes.
  allergies: jsonb('allergies').$type<string[]>().notNull().default([]),
  currentPhase: text('current_phase'),
  cookingComplexity: text('cooking_complexity').notNull().default('intermediate'),
  dietaryTargets: jsonb('dietary_targets').$type<Record<string, string>>(),
  localSpecialties: text('local_specialties'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export type UserPreferences = typeof userPreferences.$inferSelect
export type NewUserPreferences = typeof userPreferences.$inferInsert
