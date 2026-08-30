import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string
  email: string
  displayName: string | null
  credits: number
  isAdmin: boolean
  onboardingCompleted: boolean
  createdAt: string
  planCount: number
  llmCostEur: string
}

type AdminSettings = {
  llm_model: string
  prompt_version: string
  available_prompt_versions: string[]
}

// ─── Section Utilisateurs ─────────────────────────────────────────────────────

function UsersSection() {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<{ users: AdminUser[] }>('/api/admin/users'),
  })

  const creditsMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      api.post(`/api/admin/users/${id}/credits`, { delta }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>

  const usersList = data?.users ?? []

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-400">Utilisateur</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400">Plans</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400">Coût LLM</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400">Crédits</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-400">Ajuster</th>
            </tr>
          </thead>
          <tbody>
            {usersList.map((u) => (
              <tr key={u.id} className="border-b border-stone-50">
                <td className="px-4 py-2.5">
                  <p className="text-stone-800">
                    {u.displayName ?? '—'}
                    {u.isAdmin && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-stone-800 text-white">admin</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-400">{u.email}</p>
                </td>
                <td className="px-4 py-2.5 text-right text-stone-600">{u.planCount}</td>
                <td className="px-4 py-2.5 text-right text-xs text-stone-400">
                  {parseFloat(u.llmCostEur).toFixed(2)} €
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-medium ${u.credits > 0 ? 'text-stone-800' : 'text-red-600'}`}>
                    {u.credits}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {[-1, 1, 5, 10].map((delta) => (
                      <button
                        key={delta}
                        onClick={() => creditsMutation.mutate({ id: u.id, delta })}
                        disabled={creditsMutation.isPending || (delta < 0 && u.credits === 0)}
                        className="rounded border border-stone-200 px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-400">
        Les ajustements sont journalisés dans credit_transactions. Les admins ne consomment pas de crédits.
      </p>
    </div>
  )
}

// ─── Section Réglages LLM ─────────────────────────────────────────────────────

function SettingsSection() {
  const qc = useQueryClient()
  const [model, setModel] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<AdminSettings>('/api/admin/settings'),
  })

  const mutation = useMutation({
    mutationFn: () => api.put('/api/admin/settings', {
      llm_model: model ?? data?.llm_model,
      prompt_version: version ?? data?.prompt_version,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4 max-w-md">
      <div>
        <label className="block text-sm text-stone-600 mb-1">Modèle LLM</label>
        <input
          type="text"
          value={model ?? data?.llm_model ?? ''}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-mono focus:border-stone-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-stone-400">
          Identifiant exact du modèle Anthropic (ex : claude-sonnet-4-6).
        </p>
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Version du prompt</label>
        <select
          value={version ?? data?.prompt_version ?? ''}
          onChange={(e) => setVersion(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white"
        >
          {(data?.available_prompt_versions ?? []).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-stone-400">
          Le texte des prompts est versionné dans le code. Seule la version active se choisit ici.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-md bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-sm text-green-600">Enregistré</span>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const auth = useAuth()

  if (auth.status === 'loading') return <p className="text-sm text-stone-400">Chargement…</p>
  if (auth.status !== 'authenticated' || !auth.user.isAdmin) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold text-stone-800">Administration</h1>

      <section>
        <h2 className="text-sm font-medium text-stone-700 mb-3">Comptes et crédits</h2>
        <UsersSection />
      </section>

      <section>
        <h2 className="text-sm font-medium text-stone-700 mb-3">Réglages LLM</h2>
        <SettingsSection />
      </section>
    </div>
  )
}
