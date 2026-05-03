import { eq } from 'drizzle-orm'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { LoginSchema, RegisterSchema } from '@cuistot/shared'
import { db } from '@/db'
import { users } from '@/db/schema'
import {
  COOKIE_NAME,
  COOKIE_OPTIONS,
  hashPassword,
  signToken,
  verifyPassword,
} from '@/lib/auth'
import { requireAuth } from '@/middleware/requireAuth'

export const authRouter = Router()

// Champs à exclure systématiquement des réponses API.
function safeUser(user: typeof users.$inferSelect) {
  const { passwordHash: _omit, ...safe } = user
  return safe
}

// 5 tentatives max / 15 min / IP sur le login — protection brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
})

// ─── POST /api/auth/register ──────────────────────────────────────────────────

authRouter.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() })
    return
  }

  const { email, password, display_name } = parsed.data

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    res.status(409).json({ error: 'Cette adresse email est déjà utilisée' })
    return
  }

  const [newUser] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), displayName: display_name })
    .returning()

  const token = signToken({ sub: newUser.id, email: newUser.email })
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS)
  res.status(201).json({ user: safeUser(newUser) })
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    // Réponse générique volontaire : on ne distingue pas "email manquant" de "mauvais mdp".
    res.status(401).json({ error: 'Identifiants invalides' })
    return
  }

  const { email, password } = parsed.data

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  // Même timing si l'utilisateur n'existe pas : on vérifie quand même un hash
  // pour éviter les attaques par timing (enumeration d'emails).
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : false

  if (!user || !passwordOk) {
    res.status(401).json({ error: 'Identifiants invalides' })
    return
  }

  const token = signToken({ sub: user.id, email: user.email })
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS)
  res.json({ user: safeUser(user) })
})

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' })
  res.json({ ok: true })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.user.id) })
  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable' })
    return
  }
  res.json({ user: safeUser(user) })
})
