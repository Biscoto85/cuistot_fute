import { Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AppLayout() {
  const auth = useAuth()
  const user = auth.status === 'authenticated' ? auth.user : null

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="font-semibold text-stone-800 tracking-tight">Cuistot Futé</span>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-stone-500">{user.displayName ?? user.email}</span>
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
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
