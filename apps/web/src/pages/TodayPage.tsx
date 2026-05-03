import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDate, todayDayLabel } from '@/lib/homeMode'
import type { PlanOutput } from '@cuistot/shared'

type Plan = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
  outputJson: PlanOutput
}

const DAYS_FR_MAP: Record<string, string> = {
  lundi: 'lundi', mardi: 'mardi', mercredi: 'mercredi',
  jeudi: 'jeudi', vendredi: 'vendredi', samedi: 'samedi', dimanche: 'dimanche',
}

export function TodayPage() {
  const { id } = useParams<{ id: string }>()
  const today = new Date()
  const dayLabel = todayDayLabel(today)
  const todayKey = Object.keys(DAYS_FR_MAP).find((k) => dayLabel.toLowerCase().startsWith(k)) ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => api.get<{ plan: Plan }>(`/api/plans/${id}`),
    enabled: !!id,
  })

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>
  if (error || !data) return <p className="text-sm text-red-500">Plan introuvable.</p>

  const plan = data.plan
  const output = plan.outputJson
  const dayPlan = output.daily_plan.find((d) => d.day === todayKey)

  // Détecte si des ingrédients doivent sortir du congélateur
  const congélItems: string[] = []
  if (dayPlan) {
    for (const slot of [dayPlan.lunch, dayPlan.dinner]) {
      if (slot?.assembly_note?.toLowerCase().includes('congél')) {
        congélItems.push(slot.assembly_note)
      }
    }
  }

  // Repas de demain (pour sortir le congel la veille)
  const dayIndex = output.daily_plan.findIndex((d) => d.day === todayKey)
  const tomorrowPlan = dayIndex >= 0 ? output.daily_plan[dayIndex + 1] : undefined

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 capitalize">{dayLabel}</h1>
          <p className="text-sm text-stone-400 mt-0.5">Semaine du {fmtDate(plan.weekStartDate)}</p>
        </div>
        <Link to={`/plan/${plan.id}`} className="text-sm text-stone-400 hover:text-stone-700">
          Plan complet →
        </Link>
      </div>

      {/* Rappel congélateur */}
      {congélItems.length > 0 && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-medium text-sky-800 mb-1">À sortir du congélateur ce matin</p>
          {congélItems.map((note, i) => (
            <p key={i} className="text-xs text-sky-700">{note}</p>
          ))}
        </div>
      )}

      {/* Repas du jour */}
      {dayPlan ? (
        <div className="space-y-3">
          {dayPlan.lunch && (
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <p className="text-xs text-stone-400 mb-1">Midi</p>
              <p className="text-lg font-medium text-stone-800">{dayPlan.lunch.meal}</p>
              {dayPlan.lunch.assembly_note && (
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">{dayPlan.lunch.assembly_note}</p>
              )}
              <p className="mt-2 text-xs text-stone-400">{dayPlan.lunch.assembly_time_min} min</p>
            </div>
          )}
          {dayPlan.dinner && (
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <p className="text-xs text-stone-400 mb-1">Soir</p>
              <p className="text-lg font-medium text-stone-800">{dayPlan.dinner.meal}</p>
              {dayPlan.dinner.assembly_note && (
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">{dayPlan.dinner.assembly_note}</p>
              )}
              <p className="mt-2 text-xs text-stone-400">{dayPlan.dinner.assembly_time_min} min</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-stone-400 text-sm">Aucun repas planifié aujourd'hui.</p>
        </div>
      )}

      {/* Aperçu demain */}
      {tomorrowPlan && (
        <div className="rounded-lg border border-stone-100 px-4 py-3">
          <p className="text-xs text-stone-400 mb-2 font-medium uppercase tracking-wide">Demain — {tomorrowPlan.day}</p>
          <div className="flex gap-4 text-sm text-stone-600">
            {tomorrowPlan.lunch && <span>Midi : {tomorrowPlan.lunch.meal}</span>}
            {tomorrowPlan.dinner && <span>Soir : {tomorrowPlan.dinner.meal}</span>}
          </div>
        </div>
      )}

      {/* Petit-déj */}
      {output.breakfast && output.breakfast.daily_options.length > 0 && (
        <div className="rounded-lg border border-stone-100 px-4 py-3">
          <p className="text-xs text-stone-400 mb-1 font-medium uppercase tracking-wide">Petit-déjeuner</p>
          <p className="text-sm text-stone-600">{output.breakfast.daily_options.join(' · ')}</p>
        </div>
      )}

      {/* Navigation jours */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {output.daily_plan.map((d) => {
          const isToday = d.day === todayKey
          return (
            <div
              key={d.day}
              className={`flex-shrink-0 rounded-md px-3 py-1.5 text-xs capitalize ${
                isToday
                  ? 'bg-stone-800 text-white'
                  : 'border border-stone-200 text-stone-500'
              }`}
            >
              {d.day.slice(0, 3)}
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 text-sm text-stone-400">
        <Link to={`/plan/${plan.id}/shopping`} className="hover:text-stone-700">
          Liste de courses →
        </Link>
      </div>
    </div>
  )
}
