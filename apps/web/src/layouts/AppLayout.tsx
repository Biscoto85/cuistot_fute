import { Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AppLayout() {
  const auth = useAuth()
  const user = auth.status === 'authenticated' ? auth.user : null

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="font-semibold text-stone-800 tracking-tight">Cuistot Futé</span>
          <div className="flex items-center gap-3 sm:gap-4">
            {user && !user.isAdmin && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  user.credits > 0 ? 'bg-stone-100 text-stone-600' : 'bg-red-50 text-red-600'
                }`}
                title="1 crédit = 1 génération de plan"
              >
                {user.credits} crédit{user.credits > 1 ? 's' : ''}
              </span>
            )}
            {user && (
              <span className="hidden sm:inline text-sm text-stone-500">{user.displayName ?? user.email}</span>
            )}
            <button
              onClick={auth.logout}
              className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
