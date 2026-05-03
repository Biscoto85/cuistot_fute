import argon2 from 'argon2'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = '30d'

export const COOKIE_NAME = 'auth_token'

// secure=true uniquement en prod : en dev (HTTP), le navigateur rejetterait le cookie.
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
}

export interface JwtPayload {
  sub: string  // user id
  email: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET)
  if (typeof decoded === 'string') throw new Error('Token invalide')
  return decoded as JwtPayload
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    // argon2.verify lance si le hash est malformé — on traite ça comme un échec.
    return false
  }
}
