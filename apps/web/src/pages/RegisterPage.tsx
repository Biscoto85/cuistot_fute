import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { api, ApiError } from '@/lib/api'

export function RegisterPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/api/auth/register', { email, password, display_name: displayName || undefined })
      await refresh()
      navigate('/app', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Une erreur est survenue.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-2xl font-semibold text-stone-800">Créer un compte</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-600 mb-1" htmlFor="displayName">Prénom</label>
            <input
              id="displayName"
              type="text"
              autoComplete="given-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="mt-6 text-sm text-stone-500">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-stone-800 underline underline-offset-2">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
