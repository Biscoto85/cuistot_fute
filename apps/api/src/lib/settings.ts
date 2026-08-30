import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appSettings } from '@/db/schema'

// Lecture tolérante : si la table n'existe pas encore (migration non appliquée)
// ou en environnement de test (db mockée), on retombe sur la valeur par défaut
// plutôt que de faire échouer la génération.
export async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) })
    return row?.value ?? fallback
  } catch {
    return fallback
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}
