import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { fmtDate } from '@/lib/homeMode'

// ─── Types ────────────────────────────────────────────────────────────────────

type MealEntry = {
  id: string
  slot: string
  mealLabel: string
  isFavorite: boolean
}

type Plan = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
}

type Rating = -1 | 0 | 1

type EntryRating = { rating: Rating | null; comment: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SLOT_ORDER: Record<string, number> = {
  'lundi-midi': 0, 'lundi-soir': 1,
  'mardi-midi': 2, 'mardi-soir': 3,
  'mercredi-midi': 4, 'mercredi-soir': 5,
  'jeudi-midi': 6, 'jeudi-soir': 7,
  'vendredi-midi': 8, 'vendredi-soir': 9,
  'samedi-midi': 10, 'samedi-soir': 11,
  'dimanche-midi': 12, 'dimanche-soir': 13,
}

function sortEntries(entries: MealEntry[]): MealEntry[] {
  return [...entries].sort((a, b) => (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99))
}

function slotLabel(slot: string): string {
  const [day, period] = slot.split('-')
  const days: Record<string, string> = {
    lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
    jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
  }
  return `${days[day] ?? day} ${period}`
}

const RATING_CONFIG: { value: Rating; label: string; activeClass: string; inactiveClass: string }[] = [
  { value: 1, label: '👍', activeClass: 'bg-green-100 text-green-700 border-green-300', inactiveClass: 'border-stone-200 text-stone-400 hover:border-green-200 hover:text-green-600' },
  { value: 0, label: '😐', activeClass: 'bg-stone-100 text-stone-600 border-stone-300', inactiveClass: 'border-stone-200 text-stone-400 hover:border-stone-300' },
  { value: -1, label: '👎', activeClass: 'bg-red-100 text-red-600 border-red-300', inactiveClass: 'border-stone-200 text-stone-400 hover:border-red-200 hover:text-red-500' },
]

// ─── Page principale ──────────────────────────────────────────────────────────

export function RatePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => api.get<{ plan: Plan }>(`/api/plans/${id}`),
    enabled: !!id,
  })

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['meal-entries', id],
    queryFn: () => api.get<{ entries: MealEntry[] }>(`/api/meal-entries?plan_id=${id}`),
    enabled: !!id,
  })

  const [ratings, setRatings] = useState<Record<string, EntryRating>>({})
  const [showComments, setShowComments] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = Object.entries(ratings)
        .filter(([, r]) => r.rating !== null)
        .map(([meal_entry_id, r]) => ({
          meal_entry_id,
          rating: r.rating as Rating,
          ...(r.comment.trim() ? { comment: r.comment.trim() } : {}),
        }))
      if (payload.length === 0) throw new Error('Notez au moins un repas.')
      return api.post('/api/ratings', payload)
    },
    onSuccess: () => navigate('/plan/new'),
    onError: (err) => setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Erreur.'),
  })

  function setRating(entryId: string, rating: Rating) {
    setRatings((prev) => ({
      ...prev,
      [entryId]: { rating, comment: prev[entryId]?.comment ?? '' },
    }))
  }

  function setComment(entryId: string, comment: string) {
    setRatings((prev) => ({
      ...prev,
      [entryId]: { rating: prev[entryId]?.rating ?? null, comment },
    }))
  }

  function toggleComment(entryId: string) {
    setShowComments((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  if (planLoading || entriesLoading) return <p className="text-sm text-stone-400">Chargement…</p>
  if (!planData || !entriesData) return <p className="text-sm text-red-500">Plan introuvable.</p>

  const plan = planData.plan
  const entries = sortEntries(entriesData.entries)
  const ratedCount = Object.values(ratings).filter((r) => r.rating !== null).length

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Comment s'est passée la semaine ?</h1>
          <p className="text-sm text-stone-500 mt-0.5">Semaine du {fmtDate(plan.weekStartDate)}</p>
        </div>
        <Link to={`/plan/${plan.id}`} className="text-sm text-stone-400 hover:text-stone-700 shrink-0">
          ← Plan
        </Link>
      </div>

      <p className="text-sm text-stone-500">
        Notez les repas que vous avez mangés. Ces notes guident les prochains plans.
      </p>

      {/* Liste des repas */}
      <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-50 overflow-hidden">
        {entries.map((entry) => {
          const entryRating = ratings[entry.id]
          return (
            <div key={entry.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                {/* Slot label */}
                <span className="text-xs text-stone-400 w-16 shrink-0">{slotLabel(entry.slot)}</span>

                {/* Nom du plat */}
                <span className="flex-1 text-sm text-stone-700 font-medium">{entry.mealLabel}</span>

                {/* Boutons de notation */}
                <div className="flex gap-1 shrink-0">
                  {RATING_CONFIG.map(({ value, label, activeClass, inactiveClass }) => (
                    <button
                      key={value}
                      onClick={() => setRating(entry.id, value)}
                      className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
                        entryRating?.rating === value ? activeClass : inactiveClass
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Lien commentaire */}
                {entryRating?.rating !== undefined && entryRating.rating !== null && (
                  <button
                    onClick={() => toggleComment(entry.id)}
                    className="text-xs text-stone-400 hover:text-stone-600 shrink-0"
                  >
                    {showComments.has(entry.id) ? '−' : '+'}
                  </button>
                )}
              </div>

              {/* Champ commentaire (conditionnel) */}
              {showComments.has(entry.id) && (
                <input
                  type="text"
                  value={entryRating?.comment ?? ''}
                  onChange={(e) => setComment(entry.id, e.target.value)}
                  placeholder="Commentaire optionnel…"
                  className="w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-600 focus:border-stone-400 focus:outline-none"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/plan/new')}
          className="text-sm text-stone-400 hover:text-stone-700"
        >
          Passer
        </button>
        <div className="flex items-center gap-4">
          {ratedCount > 0 && (
            <span className="text-xs text-stone-400">{ratedCount} / {entries.length} notés</span>
          )}
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || ratedCount === 0}
            className="rounded-md bg-stone-800 px-5 py-2.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {submitMutation.isPending ? 'Enregistrement…' : 'Enregistrer les notes'}
          </button>
        </div>
      </div>
    </div>
  )
}
