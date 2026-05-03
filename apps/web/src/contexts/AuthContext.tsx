import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '@/lib/api'

type AuthUser = {
  id: string
  email: string
  displayName: string | null
}

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  async function refresh() {
    try {
      const data = await api.get<{ user: AuthUser }>('/api/auth/me')
      setState({ status: 'authenticated', user: data.user })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setState({ status: 'unauthenticated' })
      } else {
        setState({ status: 'unauthenticated' })
      }
    }
  }

  useEffect(() => { refresh() }, [])

  async function login(email: string, password: string) {
    await api.post('/api/auth/login', { email, password })
    await refresh()
  }

  async function logout() {
    try { await api.post('/api/auth/logout') } catch { /* ignore */ }
    setState({ status: 'unauthenticated' })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
