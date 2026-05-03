import { integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const llmLogKindEnum = pgEnum('llm_log_kind', [
  'generate_plan',
  'regenerate_with_feedback',
  'sandbox',
])

export const llmLogs = pgTable('llm_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Nullable : les appels sandbox (CLI) n'ont pas forcément de user.
  // CASCADE : si le user supprime son compte, ses logs sont supprimés (RGPD).
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  kind: llmLogKindEnum('kind').notNull(),
  promptVersion: text('prompt_version').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  userPrompt: text('user_prompt').notNull(),
  responseRaw: text('response_raw').notNull(),
  responseParsedJson: jsonb('response_parsed_json'),
  validationError: text('validation_error'),
  latencyMs: integer('latency_ms').notNull(),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  costEstimateEur: numeric('cost_estimate_eur'),
  // Pas de updated_at : les logs sont immuables.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type LlmLog = typeof llmLogs.$inferSelect
export type NewLlmLog = typeof llmLogs.$inferInsert
