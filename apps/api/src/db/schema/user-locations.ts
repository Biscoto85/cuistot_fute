import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const locationKindEnum = pgEnum('location_kind', [
  'supermarche',
  'bio',
  'marche',
  'primeur',
  'boucherie',
  'fromagerie',
  'autre',
])

export const userLocations = pgTable('user_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: locationKindEnum('kind').notNull(),
  notes: text('notes'),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export type UserLocation = typeof userLocations.$inferSelect
export type NewUserLocation = typeof userLocations.$inferInsert
