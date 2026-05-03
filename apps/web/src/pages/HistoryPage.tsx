import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/homeMode'

type PlanSummary = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
}

const STATUS_LABEL: Record<PlanSummary['status'], string> = {
  draft: 'Brouillon',
  active: 'Actif',
  archived: 'Archivé',
}

const STATUS_STYLE: Record<PlanSummary['status'], string> = {
  draft: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-stone-100 text-stone-500',
}

export function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<{ plans: PlanSummary[] }>('/api/plans'),
  })

  const plans = data?.plans ?? []

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Historique</h1>
        <Link
          to="/plan/new"
          className="rounded-md bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 transition-colors"
        >
          Nouveau plan
        </Link>
      </div>

      {isLoading && <p className="text-sm text-stone-400">Chargement…</p>}

      {!isLoading && plans.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-500 text-sm mb-4">Aucun plan généré pour l'instant.</p>
          <Link
            to="/plan/new"
            className="inline-block rounded-md bg-stone-800 px-5 py-2 text-sm text-white hover:bg-stone-700 transition-colors"
          >
            Générer le premier plan
          </Link>
        </div>
      )}

      {plans.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/plan/${plan.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-stone-800">
                  Semaine du {fmtDate(plan.weekStartDate)}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Généré le {new Date(plan.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[plan.status]}`}>
                  {STATUS_LABEL[plan.status]}
                </span>
                <span className="text-stone-300 text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
