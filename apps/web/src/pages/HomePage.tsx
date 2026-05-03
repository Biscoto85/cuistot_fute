import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { getHomeMode, nextMonday, fmtDate, todayDayLabel } from '@/lib/homeMode'
import type { PlanOutput } from '@cuistot/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanSummary = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
}

type PantryTarget = {
  id: string
  name: string
  rotationMonths: number
  lastPurchasedAt: string | null
  priority: string
}

type ActivePlan = PlanSummary & {
  outputJson: PlanOutput
  inputsJson: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRotationExpired(target: PantryTarget): boolean {
  if (!target.lastPurchasedAt) return target.priority === 'essentiel'
  const lastDate = new Date(target.lastPurchasedAt + 'T00:00:00')
  const expiresAt = new Date(lastDate)
  expiresAt.setMonth(expiresAt.getMonth() + target.rotationMonths)
  return new Date() > expiresAt
}

// ─── Composants de mode ───────────────────────────────────────────────────────

function ModeToGenerate({ weekLabel }: { weekLabel: string }) {
  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm">Aucun plan actif pour cette semaine.</p>
      <Link
        to="/plan/new"
        className="inline-block rounded-md bg-stone-800 px-6 py-3 text-sm text-white hover:bg-stone-700 transition-colors"
      >
        Générer le plan — semaine du {weekLabel}
      </Link>
    </div>
  )
}

function ModeShopping({ plan }: { plan: ActivePlan }) {
  const output = plan.outputJson
  const totalItems = output.shopping_list.reduce((n, l) => n + l.items.length, 0)
  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm">Semaine du {fmtDate(plan.weekStartDate)} — {totalItems} article{totalItems > 1 ? 's' : ''} à acheter.</p>
      <div className="flex gap-3">
        <Link
          to={`/plan/${plan.id}/shopping`}
          className="inline-block rounded-md bg-stone-800 px-5 py-2.5 text-sm text-white hover:bg-stone-700 transition-colors"
        >
          Voir la liste de courses
        </Link>
        <Link
          to={`/plan/${plan.id}`}
          className="inline-block rounded-md border border-stone-300 px-5 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Plan complet
        </Link>
      </div>
    </div>
  )
}

function ModeCooking({ plan }: { plan: ActivePlan }) {
  const preps = plan.outputJson.sunday_batch.preparations
  const totalMin = plan.outputJson.sunday_batch.estimated_total_time_min
  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm">Dimanche batch · {totalMin} min estimées</p>
      <div className="space-y-2">
        {preps.map((prep, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-600">{i + 1}</span>
            <div>
              <p className="text-sm font-medium text-stone-800">{prep.name}</p>
              {prep.short_instructions && <p className="mt-0.5 text-xs text-stone-500">{prep.short_instructions}</p>}
              <p className="mt-1 text-xs text-stone-400">{prep.time_min} min</p>
            </div>
          </div>
        ))}
      </div>
      <Link to={`/plan/${plan.id}`} className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800">
        Plan de semaine complet
      </Link>
    </div>
  )
}

function ModeWeekday({ plan, today }: { plan: ActivePlan; today: Date }) {
  const dayName = todayDayLabel(today)
  const FR_DAYS: Record<string, string> = {
    lundi: 'lundi', mardi: 'mardi', mercredi: 'mercredi',
    jeudi: 'jeudi', vendredi: 'vendredi', samedi: 'samedi', dimanche: 'dimanche',
  }
  const todayKey = Object.keys(FR_DAYS).find((k) => dayName.toLowerCase().startsWith(k)) ?? ''
  const dayPlan = plan.outputJson.daily_plan.find((d) => d.day === todayKey)

  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm capitalize">{dayName} — semaine du {fmtDate(plan.weekStartDate)}</p>
      {dayPlan ? (
        <div className="grid grid-cols-2 gap-3">
          {dayPlan.lunch && (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-400 mb-1">Midi</p>
              <p className="text-sm font-medium text-stone-800">{dayPlan.lunch.meal}</p>
              {dayPlan.lunch.assembly_note && (
                <p className="mt-1 text-xs text-stone-500">{dayPlan.lunch.assembly_note}</p>
              )}
            </div>
          )}
          {dayPlan.dinner && (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-400 mb-1">Soir</p>
              <p className="text-sm font-medium text-stone-800">{dayPlan.dinner.meal}</p>
              {dayPlan.dinner.assembly_note && (
                <p className="mt-1 text-xs text-stone-500">{dayPlan.dinner.assembly_note}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-stone-400 text-sm">Aucun repas planifié aujourd'hui.</p>
      )}
      <Link to={`/plan/${plan.id}/today`} className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800">
        Vue du jour complète
      </Link>
    </div>
  )
}

function ModeFeedbackPending({ plan }: { plan: PlanSummary }) {
  return (
    <div className="space-y-4">
      <p className="text-stone-500 text-sm">Semaine du {fmtDate(plan.weekStartDate)} terminée.</p>
      <p className="text-sm text-stone-600">Comment s'est passée la semaine ?</p>
      <div className="flex gap-3">
        <Link
          to={`/plan/${plan.id}/rate`}
          className="inline-block rounded-md bg-stone-800 px-5 py-2.5 text-sm text-white hover:bg-stone-700 transition-colors"
        >
          Noter les repas
        </Link>
        <Link
          to="/plan/new"
          className="inline-block rounded-md border border-stone-300 px-5 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Générer la semaine suivante
        </Link>
      </div>
    </div>
  )
}

// ─── Alertes pantry ───────────────────────────────────────────────────────────

function PantryAlerts({ targets }: { targets: PantryTarget[] }) {
  const expired = targets.filter(isRotationExpired)
  if (expired.length === 0) return null
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-800 mb-1">Renouvellement garde-manger</p>
      <ul className="space-y-0.5">
        {expired.slice(0, 4).map((t) => (
          <li key={t.id} className="text-xs text-amber-700">
            {t.name}{t.lastPurchasedAt ? ` — dernier achat ${fmtDate(t.lastPurchasedAt)}` : ' — jamais acheté'}
          </li>
        ))}
        {expired.length > 4 && <li className="text-xs text-amber-600">+{expired.length - 4} autres</li>}
      </ul>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function HomePage() {
  const auth = useAuth()
  const displayName = auth.status === 'authenticated' ? (auth.user.displayName ?? '') : ''

  const today = new Date()

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<{ plans: PlanSummary[] }>('/api/plans'),
  })

  const { data: pantryData } = useQuery({
    queryKey: ['pantry-targets'],
    queryFn: () => api.get<{ targets: PantryTarget[] }>('/api/pantry-targets'),
  })

  const plans = plansData?.plans ?? []
  const { mode, plan: activePlanSummary } = getHomeMode(today, plans)

  const { data: activePlanDetail } = useQuery({
    queryKey: ['plan', activePlanSummary?.id],
    queryFn: () => api.get<{ plan: ActivePlan }>(`/api/plans/${activePlanSummary!.id}`),
    enabled: !!activePlanSummary && mode !== 'to-generate' && mode !== 'feedback-pending',
  })

  const activePlan = activePlanDetail?.plan ?? null

  if (plansLoading) {
    return <p className="text-sm text-stone-400">Chargement…</p>
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-stone-800">
          {displayName ? `Bonjour, ${displayName.split(' ')[0]}` : 'Accueil'}
        </h1>
      </div>

      {/* Bloc contextuel principal */}
      <section className="rounded-xl border border-stone-200 bg-white p-6">
        {mode === 'to-generate' && (
          <ModeToGenerate weekLabel={fmtDate(nextMonday(today))} />
        )}
        {mode === 'feedback-pending' && activePlanSummary && (
          <ModeFeedbackPending plan={activePlanSummary} />
        )}
        {mode === 'shopping' && activePlan && (
          <ModeShopping plan={activePlan} />
        )}
        {mode === 'cooking' && activePlan && (
          <ModeCooking plan={activePlan} />
        )}
        {mode === 'weekday' && activePlan && (
          <ModeWeekday plan={activePlan} today={today} />
        )}
        {/* Fallback pendant chargement du détail plan */}
        {['shopping', 'cooking', 'weekday'].includes(mode) && !activePlan && (
          <p className="text-sm text-stone-400">Chargement du plan…</p>
        )}
      </section>

      {/* Alertes pantry */}
      {pantryData?.targets && <PantryAlerts targets={pantryData.targets} />}

      {/* Raccourcis */}
      <section className="flex gap-3 flex-wrap">
        <Link
          to="/plan/new"
          className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Nouveau plan
        </Link>
        <Link
          to="/favorites"
          className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Favoris
        </Link>
        <Link
          to="/history"
          className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Historique
        </Link>
        <Link
          to="/preferences"
          className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Préférences
        </Link>
      </section>

      {/* Plans récents si plusieurs */}
      {plans.filter((p) => p.status === 'active' || p.status === 'archived').length > 1 && (
        <section>
          <h2 className="text-sm font-medium text-stone-600 mb-2">Plans récents</h2>
          <div className="space-y-1">
            {plans.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                to={`/plan/${p.id}`}
                className="flex items-center justify-between rounded-md border border-stone-100 bg-white px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors"
              >
                <span className="text-stone-700">Semaine du {fmtDate(p.weekStartDate)}</span>
                <span className="text-xs text-stone-400 capitalize">{p.status}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
