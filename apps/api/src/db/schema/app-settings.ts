import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Réglages globaux modifiables par l'admin (modèle LLM, version de prompt).
// Le TEXTE des prompts reste versionné dans le code (CLAUDE.md) — seule la
// version active est choisie ici.
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AppSetting = typeof appSettings.$inferSelect
