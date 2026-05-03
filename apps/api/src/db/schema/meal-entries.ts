import { boolean, date, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { weeklyPlans } from './weekly-plans'

export const mealEntries = pgTable('meal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
  slot: text('slot').notNull(),
  mealLabel: text('meal_label').notNull(),
  mealDataJson: jsonb('meal_data_json'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  eatenAt: date('eaten_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type MealEntry = typeof mealEntries.$inferSelect
export type NewMealEntry = typeof mealEntries.$inferInsert
