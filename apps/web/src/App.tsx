import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { HomePage } from '@/pages/HomePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route element={<AppLayout />}>
                <Route path="/app" element={<HomePage />} />
                <Route path="/plan/new" element={<PlaceholderPage title="Nouveau plan" />} />
                <Route path="/plan/:id" element={<PlaceholderPage title="Plan" />} />
                <Route path="/plan/:id/shopping" element={<PlaceholderPage title="Liste de courses" />} />
                <Route path="/plan/:id/today" element={<PlaceholderPage title="Vue du jour" />} />
                <Route path="/history" element={<PlaceholderPage title="Historique" />} />
                <Route path="/favorites" element={<PlaceholderPage title="Favoris" />} />
                <Route path="/preferences" element={<PlaceholderPage title="Préférences" />} />
                <Route path="/legal" element={<PlaceholderPage title="Mentions légales" />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
