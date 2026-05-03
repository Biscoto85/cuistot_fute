import { date, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const planStatusEnum = pgEnum('plan_status', ['draft', 'active', 'archived'])

export const weeklyPlans = pgTable('weekly_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  weekStartDate: date('week_start_date').notNull(),
  inputsJson: jsonb('inputs_json').notNull(),
  outputJson: jsonb('output_json').notNull(),
  status: planStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Le statut et les notes peuvent être modifiés après création.
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export type WeeklyPlan = typeof weeklyPlans.$inferSelect
export type NewWeeklyPlan = typeof weeklyPlans.$inferInsert
