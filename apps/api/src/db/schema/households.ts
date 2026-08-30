import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  adults: integer('adults').notNull().default(1),
  children: integer('children').notNull().default(0),
  // Âges en années révolues — children reste le compteur, maintenu = childrenAges.length côté API
  childrenAges: jsonb('children_ages').$type<number[]>().notNull().default([]),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export type Household = typeof households.$inferSelect
export type NewHousehold = typeof households.$inferInsert
