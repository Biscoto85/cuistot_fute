import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'

type MealEntry = {
  id: string
  planId: string
  slot: string
  mealLabel: string
  isFavorite: boolean
  createdAt: string
}

export function FavoritesPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.get<{ entries: MealEntry[] }>('/api/meal-entries/favorites'),
  })

  const unfavoriteMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/meal-entries/${id}`, { is_favorite: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const entries = data?.entries ?? []

  // Déduplique par mealLabel pour n'afficher chaque plat qu'une fois (garde le plus récent)
  const seen = new Set<string>()
  const unique = entries.filter((e) => {
    if (seen.has(e.mealLabel)) return false
    seen.add(e.mealLabel)
    return true
  })

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Favoris</h1>

      {isLoading && <p className="text-sm text-stone-400">Chargement…</p>}

      {!isLoading && unique.length === 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-500 text-sm mb-2">Aucun repas favori pour l'instant.</p>
          <p className="text-xs text-stone-400">
            Marquez un repas avec ★ dans la vue plan pour le retrouver ici.
          </p>
        </div>
      )}

      {unique.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
          {unique.map((entry) => (
            <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="text-amber-400 text-base leading-none shrink-0">★</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{entry.mealLabel}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {slotLabel(entry.slot)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/plan/${entry.planId}`}
                  className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                >
                  Voir plan
                </Link>
                <button
                  onClick={() => unfavoriteMutation.mutate(entry.id)}
                  disabled={unfavoriteMutation.isPending}
                  className="text-xs text-stone-300 hover:text-red-400 transition-colors"
                  title="Retirer des favoris"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-400">
        {unique.length} favori{unique.length > 1 ? 's' : ''}
        {entries.length > unique.length && ` (${entries.length} au total, dédupliqués par nom)`}
      </p>
    </div>
  )
}

function slotLabel(slot: string): string {
  const [day, period] = slot.split('-')
  const days: Record<string, string> = {
    lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
    jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
  }
  const periods: Record<string, string> = { midi: 'midi', soir: 'soir' }
  return `${days[day] ?? day} ${periods[period] ?? period}`
}
