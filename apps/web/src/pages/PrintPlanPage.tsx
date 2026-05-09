import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/homeMode'
import type { PlanOutput } from '@cuistot/shared'

type Plan = {
  id: string
  weekStartDate: string
  status: string
  outputJson: PlanOutput
}

const DAYS_FR: Record<string, string> = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi',
  jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
}

export function PrintPlanPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, isError } = useQuery<{ plan: Plan }>({
    queryKey: ['plan', id],
    queryFn: () => api.get(`/api/plans/${id}`),
  })

  if (isLoading) {
    return <div className="p-8 text-stone-500 text-sm">Chargement…</div>
  }

  const plan = data?.plan
  if (isError || !plan) {
    return <div className="p-8 text-red-600 text-sm">Plan introuvable.</div>
  }

  const output = plan.outputJson

  return (
    <div className="min-h-screen bg-white">
      {/* Bouton impression — masqué à l'impression */}
      <div className="print:hidden flex items-center justify-between px-8 pt-6 pb-4 border-b border-stone-200">
        <span className="text-sm text-stone-500">Aperçu avant impression</span>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-stone-800 px-4 py-1.5 text-sm text-white hover:bg-stone-700 transition-colors"
        >
          Imprimer / Enregistrer PDF
        </button>
      </div>

      {/* Contenu imprimable */}
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8 print:px-0 print:py-4 print:max-w-none">

        {/* En-tête */}
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Cuistot Futé</p>
          <h1 className="text-xl font-semibold text-stone-900">
            Semaine du {fmtDate(plan.weekStartDate)}
          </h1>
          <p className="text-sm text-stone-600 mt-1 leading-relaxed">{output.philosophy_summary}</p>
          {output.estimated_cost_eur > 0 && (
            <p className="text-xs text-stone-400 mt-1">Coût estimé : {output.estimated_cost_eur} €</p>
          )}
        </div>

        {/* Avertissements */}
        {output.warnings.length > 0 && (
          <div className="border border-amber-200 rounded px-4 py-2 space-y-1">
            {output.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">⚠ {w}</p>
            ))}
          </div>
        )}

        {/* Repas de la semaine */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-2 uppercase tracking-wide">Repas de la semaine</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-1.5 pr-4 text-xs font-medium text-stone-400 w-24">Jour</th>
                <th className="text-left py-1.5 pr-4 text-xs font-medium text-stone-400 w-1/2">Midi</th>
                <th className="text-left py-1.5 text-xs font-medium text-stone-400">Soir</th>
              </tr>
            </thead>
            <tbody>
              {output.daily_plan.map((day) => (
                <tr key={day.day} className="border-b border-stone-100">
                  <td className="py-1.5 pr-4 text-xs font-medium text-stone-500">{DAYS_FR[day.day] ?? day.day}</td>
                  <td className="py-1.5 pr-4">
                    {day.lunch ? (
                      <div>
                        <p className="text-stone-800">{day.lunch.meal}</p>
                        <p className="text-xs text-stone-400">{day.lunch.assembly_note}</p>
                      </div>
                    ) : <span className="text-xs text-stone-300">—</span>}
                  </td>
                  <td className="py-1.5">
                    {day.dinner ? (
                      <div>
                        <p className="text-stone-800">{day.dinner.meal}</p>
                        <p className="text-xs text-stone-400">{day.dinner.assembly_note}</p>
                      </div>
                    ) : <span className="text-xs text-stone-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Dimanche batch */}
        <section>
          <h2 className="text-sm font-semibold text-stone-700 mb-2 uppercase tracking-wide">
            Dimanche batch
            <span className="ml-2 text-xs font-normal text-stone-400 normal-case">
              {output.sunday_batch.estimated_total_time_min} min estimées
            </span>
          </h2>
          <ol className="space-y-2">
            {output.sunday_batch.preparations.map((prep, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-stone-100 text-xs font-medium text-stone-600 flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm text-stone-800">
                    {prep.name}
                    <span className="ml-2 text-xs text-stone-400">{prep.time_min} min</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">{prep.short_instructions}</p>
                  {prep.yields_for_slots.length > 0 && (
                    <p className="text-xs text-stone-400 mt-0.5">→ {prep.yields_for_slots.join(', ')}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Petit-déjeuner */}
        {output.breakfast && (
          <section>
            <h2 className="text-sm font-semibold text-stone-700 mb-2 uppercase tracking-wide">Petit-déjeuner</h2>
            {output.breakfast.sunday_prep.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-stone-400 mb-1">Préparation dimanche</p>
                {output.breakfast.sunday_prep.map((item, i) => (
                  <p key={i} className="text-sm text-stone-700">{item.name} — {item.short_instructions}</p>
                ))}
              </div>
            )}
            {output.breakfast.daily_options.length > 0 && (
              <p className="text-sm text-stone-700">
                <span className="text-xs text-stone-400 mr-1">Options :</span>
                {output.breakfast.daily_options.join(' · ')}
              </p>
            )}
          </section>
        )}

        {/* Liste de courses */}
        {output.shopping_list.length > 0 && (
          <section className="print:break-before-page">
            <h2 className="text-sm font-semibold text-stone-700 mb-3 uppercase tracking-wide">Liste de courses</h2>
            <div className="space-y-4">
              {output.shopping_list.map((loc) => (
                <div key={loc.location_id}>
                  <p className="text-xs font-medium text-stone-500 mb-1">{loc.location_name}</p>
                  <ul className="space-y-1">
                    {loc.items.map((item, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-sm">
                        <span className="inline-block w-3 h-3 border border-stone-300 rounded-sm flex-shrink-0 mt-0.5" />
                        <span className="text-stone-800">{item.item}</span>
                        <span className="text-xs text-stone-400">{item.qty}</span>
                        {item.freshness_urgency === 'day_of_cooking' && (
                          <span className="text-xs text-amber-600">J</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-3">J = à acheter le jour de la cuisson</p>
          </section>
        )}

        {/* Pied de page */}
        <div className="border-t border-stone-100 pt-4">
          <p className="text-xs text-stone-300">
            Cuistot Futé — semaine du {fmtDate(plan.weekStartDate)}
          </p>
        </div>
      </div>
    </div>
  )
}
