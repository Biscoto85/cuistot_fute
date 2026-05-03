import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
  display_name: z.string().min(1, 'Le nom est requis').max(100),
})

// Le login n'applique pas de min sur le password pour éviter de donner des indices
// sur la politique de mot de passe à quelqu'un qui teste des credentials.
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>

// ─── Household ────────────────────────────────────────────────────────────────

export const HouseholdUpdateSchema = z.object({
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  description: z.string().max(500).nullish(),
})

export type HouseholdUpdateInput = z.infer<typeof HouseholdUpdateSchema>

// ─── Locations ────────────────────────────────────────────────────────────────

export const LOCATION_KINDS = [
  'supermarche',
  'bio',
  'marche',
  'primeur',
  'boucherie',
  'fromagerie',
  'autre',
] as const

export type LocationKind = (typeof LOCATION_KINDS)[number]

export const LocationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(LOCATION_KINDS),
  notes: z.string().max(1000).nullish(),
  priority: z.number().int().min(0).default(0),
})

export const LocationUpdateSchema = LocationCreateSchema.partial()

export type LocationCreateInput = z.infer<typeof LocationCreateSchema>
export type LocationUpdateInput = z.infer<typeof LocationUpdateSchema>

// ─── Preferences ──────────────────────────────────────────────────────────────

export const PreferencesUpdateSchema = z.object({
  loves: z.array(z.string().min(1)).optional(),
  dislikes: z.array(z.string().min(1)).optional(),
  allergies: z.array(z.string().min(1)).optional(),
  current_phase: z.string().max(200).nullish(),
  dietary_targets: z.record(z.string()).nullish(),
  local_specialties: z.string().max(1000).nullish(),
  notes: z.string().max(1000).nullish(),
})

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>
