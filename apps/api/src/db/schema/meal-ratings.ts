import { check } from 'drizzle-orm/pg-core'
import { pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { mealEntries } from './meal-entries'
import { users } from './users'

export const mealRatings = pgTable(
  'meal_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Nullable : un rating peut être saisi sans être lié à un meal_entry existant.
    // SET NULL si le meal_entry est supprimé — on garde le rating avec le label dénormalisé.
    mealEntryId: uuid('meal_entry_id').references(() => mealEntries.id, {
      onDelete: 'set null',
    }),
    mealLabel: text('meal_label').notNull(),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    // Pas de updated_at : un rating est immuable une fois posé.
    ratedAt: timestamp('rated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('meal_ratings_rating_check', sql`${table.rating} IN (-1, 0, 1)`),
  ],
)

export type MealRating = typeof mealRatings.$inferSelect
export type NewMealRating = typeof mealRatings.$inferInsert
