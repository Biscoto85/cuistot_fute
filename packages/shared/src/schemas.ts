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
