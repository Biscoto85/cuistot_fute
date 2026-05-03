import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { fmtDate } from '@/lib/homeMode'
import type { PlanOutput } from '@cuistot/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
  outputJson: PlanOutput
  inputsJson: Record<string, unknown>
  notes: string | null
  createdAt: string
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function FavoriteButton({ entryId, isFav }: { entryId: string; isFav: boolean }) {
  const qc = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.patch(`/api/meal-entries/${entryId}`, { is_favorite: !isFav }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-entries'] }),
  })
  return (
    <button
      onClick={() => mutate()}
      disabled={isPending}
      title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      className={`text-base leading-none transition-colors ${isFav ? 'text-amber-400 hover:text-stone-400' : 'text-stone-200 hover:text-amber-400'}`}
    >
      ★
    </button>
  )
}

function DailyPlanTable({ plan, entries }: {
  plan: Plan
  entries: Array<{ id: string; slot: string; mealLabel: string; isFavorite: boolean }>
}) {
  const entryMap = new Map(entries.map((e) => [e.slot, e]))
  const DAYS_FR: Record<string, string> = {
    lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
    jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            <th className="text-left py-2 pr-4 text-xs font-medium text-stone-400 w-24">Jour</th>
            <th className="text-left py-2 pr-4 text-xs font-medium text-stone-400">Midi</th>
            <th className="text-left py-2 text-xs font-medium text-stone-400">Soir</th>
          </tr>
        </thead>
        <tbody>
          {plan.outputJson.daily_plan.map((day) => {
            const lunchEntry = entryMap.get(`${day.day}-midi`)
            const dinnerEntry = entryMap.get(`${day.day}-soir`)
            return (
              <tr key={day.day} className="border-b border-stone-50">
                <td className="py-2.5 pr-4 text-xs text-stone-500 font-medium">{DAYS_FR[day.day]}</td>
                <td className="py-2.5 pr-4">
                  {day.lunch ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-700">{day.lunch.meal}</span>
                      {lunchEntry && <FavoriteButton entryId={lunchEntry.id} isFav={lunchEntry.isFavorite} />}
                    </div>
                  ) : <span className="text-stone-300">—</span>}
                  {day.lunch?.assembly_note && (
                    <p className="text-xs text-stone-400 mt-0.5">{day.lunch.assembly_note}</p>
                  )}
                </td>
                <td className="py-2.5">
                  {day.dinner ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-700">{day.dinner.meal}</span>
                      {dinnerEntry && <FavoriteButton entryId={dinnerEntry.id} isFav={dinnerEntry.isFavorite} />}
                    </div>
                  ) : <span className="text-stone-300">—</span>}
                  {day.dinner?.assembly_note && (
                    <p className="text-xs text-stone-400 mt-0.5">{day.dinner.assembly_note}</p>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Modale de régénération ───────────────────────────────────────────────────

function RegenerateModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post<{ plan: { id: string } }>(`/api/plans/${planId}/regenerate`, { feedback }),
    onSuccess: (data) => navigate(`/plan/${data.plan.id}`),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl border border-stone-200 p-6 w-full max-w-md shadow-lg space-y-4">
        <h2 className="text-base font-semibold text-stone-800">Régénérer avec feedback</h2>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Trop de viande rouge, replace le mardi soir, j'ai envie de plus de légumes…"
          rows={4}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none"
        />
        {isPending && <p className="text-sm text-stone-400">Régénération en cours…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-stone-400 hover:text-stone-700">Annuler</button>
          <button
            onClick={() => mutate()}
            disabled={isPending || feedback.trim().length === 0}
            className="rounded-md bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {isPending ? 'Génération…' : 'Régénérer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function PlanPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showRegen, setShowRegen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => api.get<{ plan: Plan }>(`/api/plans/${id}`),
    enabled: !!id,
  })

  const { data: entriesData } = useQuery({
    queryKey: ['meal-entries', id],
    queryFn: () => api.get<{ entries: Array<{ id: string; slot: string; mealLabel: string; isFavorite: boolean }> }>(`/api/meal-entries?plan_id=${id}`),
    enabled: !!id,
  })

  const finalizeMutation = useMutation({
    mutationFn: () => api.post(`/api/plans/${id}/finalize`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan', id] })
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>
  if (error || !data) return <p className="text-sm text-red-500">Plan introuvable.</p>

  const plan = data.plan
  const output = plan.outputJson
  const entries = entriesData?.entries ?? []

  return (
    <div className="max-w-3xl space-y-8">
      {showRegen && <RegenerateModal planId={plan.id} onClose={() => setShowRegen(false)} />}

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-stone-800">
              Semaine du {fmtDate(plan.weekStartDate)}
            </h1>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
              plan.status === 'active' ? 'bg-green-100 text-green-700' :
              plan.status === 'draft' ? 'bg-amber-100 text-amber-700' :
              'bg-stone-100 text-stone-500'
            }`}>{plan.status}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            {plan.status === 'draft' && (
              <>
                <button
                  onClick={() => setShowRegen(true)}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Régénérer
                </button>
                <button
                  onClick={() => finalizeMutation.mutate()}
                  disabled={finalizeMutation.isPending}
                  className="rounded-md bg-stone-800 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
                >
                  Finaliser
                </button>
              </>
            )}
            <Link
              to={`/plan/${plan.id}/shopping`}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Liste de courses
            </Link>
          </div>
        </div>

        {/* Philosophie */}
        <p className="text-stone-600 text-sm leading-relaxed">{output.philosophy_summary}</p>

        {/* Warnings */}
        {output.warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 space-y-1">
            {output.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">{w}</p>
            ))}
          </div>
        )}

        {/* Coût estimé */}
        {output.estimated_cost_eur > 0 && (
          <p className="text-xs text-stone-400">Coût estimé : {output.estimated_cost_eur} €</p>
        )}
      </div>

      {/* Plan de la semaine */}
      <section>
        <h2 className="text-sm font-medium text-stone-700 mb-3">Repas de la semaine</h2>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <DailyPlanTable plan={plan} entries={entries} />
        </div>
      </section>

      {/* Sections détaillées — T18 */}
      <section>
        <h2 className="text-sm font-medium text-stone-700 mb-3">Dimanche batch</h2>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-400 mb-3">{output.sunday_batch.estimated_total_time_min} min estimées</p>
          <div className="space-y-2">
            {output.sunday_batch.preparations.map((prep, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-600">{i + 1}</span>
                <div>
                  <span className="text-sm text-stone-800">{prep.name}</span>
                  <span className="ml-2 text-xs text-stone-400">{prep.time_min} min</span>
                  <p className="text-xs text-stone-500 mt-0.5">{prep.short_instructions}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Petit-déj */}
      {output.breakfast && (
        <section>
          <h2 className="text-sm font-medium text-stone-700 mb-3">Petit-déjeuner</h2>
          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
            {output.breakfast.sunday_prep.length > 0 && (
              <div>
                <p className="text-xs text-stone-400 mb-1">Préparation dimanche</p>
                {output.breakfast.sunday_prep.map((item, i) => (
                  <p key={i} className="text-sm text-stone-700">{item.name} — {item.short_instructions}</p>
                ))}
              </div>
            )}
            {output.breakfast.daily_options.length > 0 && (
              <div>
                <p className="text-xs text-stone-400 mb-1">Options quotidiennes</p>
                <p className="text-sm text-stone-700">{output.breakfast.daily_options.join(' · ')}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 text-sm text-stone-400">
        <button onClick={() => navigate(-1)} className="hover:text-stone-700">← Retour</button>
        <Link to={`/plan/${plan.id}/shopping`} className="hover:text-stone-700">Liste de courses →</Link>
      </div>
    </div>
  )
}
