import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { HomePage } from '@/pages/HomePage'
import { GeneratePage } from '@/pages/GeneratePage'
import { PlanPage } from '@/pages/PlanPage'
import { ShoppingPage } from '@/pages/ShoppingPage'
import { TodayPage } from '@/pages/TodayPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { FavoritesPage } from '@/pages/FavoritesPage'
import { PreferencesPage } from '@/pages/PreferencesPage'
import { RatePage } from '@/pages/RatePage'
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
                <Route path="/plan/new" element={<GeneratePage />} />
                <Route path="/plan/:id" element={<PlanPage />} />
                <Route path="/plan/:id/shopping" element={<ShoppingPage />} />
                <Route path="/plan/:id/today" element={<TodayPage />} />
                <Route path="/plan/:id/rate" element={<RatePage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/preferences" element={<PreferencesPage />} />
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
