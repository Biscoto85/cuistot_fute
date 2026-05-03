import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL est requis')
}

// postgres-js gère le pool de connexions en interne.
// En production, une seule instance est partagée via ce module.
const client = postgres(process.env.DATABASE_URL)

export const db = drizzle(client, { schema })

// Type utilitaire pour les fonctions qui reçoivent la DB en paramètre (ex: tests).
export type Db = typeof db
