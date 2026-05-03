import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-400 text-sm">Chargement…</p>
      </div>
    )
  }

  if (auth.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
