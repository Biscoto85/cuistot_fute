import { date, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { userLocations } from './user-locations'
import { users } from './users'

export const pantryCategoryEnum = pgEnum('pantry_category', [
  'cereales',
  'legumineuses',
  'conserves',
  'huiles_vinaigres',
  'epices',
  'condiments',
  'boissons',
  'sucres_farines',
  'secs_divers',
  'autre',
])

export const pantryUnitEnum = pgEnum('pantry_unit', [
  'kg',
  'g',
  'L',
  'mL',
  'pieces',
  'boites',
  'sachets',
])

export const pantryPriorityEnum = pgEnum('pantry_priority', ['essentiel', 'secondaire'])

export const pantryStockStatusEnum = pgEnum('pantry_stock_status', ['ok', 'bas', 'vide'])

export const pantryTargets = pgTable('pantry_targets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: pantryCategoryEnum('category').notNull(),
  targetQuantity: numeric('target_quantity').notNull(),
  unit: pantryUnitEnum('unit').notNull(),
  rotationMonths: integer('rotation_months').notNull().default(6),
  lastPurchasedAt: date('last_purchased_at'),
  priority: pantryPriorityEnum('priority').notNull(),
  // État déclaré par l'utilisateur — 'vide' interdit au LLM de supposer l'article disponible
  stockStatus: pantryStockStatusEnum('stock_status').notNull().default('ok'),
  // Nullable car l'utilisateur peut ne pas associer un lieu à chaque cible.
  // SET NULL si le lieu est supprimé plutôt que CASCADE (la cible doit survivre).
  preferredLocationId: uuid('preferred_location_id').references(() => userLocations.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})

export type PantryTarget = typeof pantryTargets.$inferSelect
export type NewPantryTarget = typeof pantryTargets.$inferInsert
