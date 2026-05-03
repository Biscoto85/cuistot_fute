import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtDate } from '@/lib/homeMode'
import type { PlanOutput } from '@cuistot/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
  outputJson: PlanOutput
}

type CheckState = Record<string, boolean> // key: `${location_id}::${item}`

// ─── Persistance localStorage ─────────────────────────────────────────────────

function storageKey(planId: string) {
  return `cuistot-shopping-${planId}`
}

function loadChecks(planId: string): CheckState {
  try {
    const raw = localStorage.getItem(storageKey(planId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveChecks(planId: string, state: CheckState) {
  try {
    localStorage.setItem(storageKey(planId), JSON.stringify(state))
  } catch { /* ignore */ }
}

function itemKey(locationId: string, item: string): string {
  return `${locationId}::${item}`
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ShoppingPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => api.get<{ plan: Plan }>(`/api/plans/${id}`),
    enabled: !!id,
  })

  const [checks, setChecks] = useState<CheckState>({})
  const [activeLocation, setActiveLocation] = useState<string | null>(null)
  const [showUrgentOnly, setShowUrgentOnly] = useState(false)

  useEffect(() => {
    if (id) setChecks(loadChecks(id))
  }, [id])

  function toggle(locationId: string, item: string) {
    const key = itemKey(locationId, item)
    const next = { ...checks, [key]: !checks[key] }
    setChecks(next)
    if (id) saveChecks(id, next)
  }

  function resetLocation(locationId: string, items: string[]) {
    const next = { ...checks }
    for (const item of items) delete next[itemKey(locationId, item)]
    setChecks(next)
    if (id) saveChecks(id, next)
  }

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>
  if (error || !data) return <p className="text-sm text-red-500">Plan introuvable.</p>

  const plan = data.plan
  const output = plan.outputJson
  const locations = output.shopping_list

  const displayedLocations = activeLocation
    ? locations.filter((l) => l.location_id === activeLocation)
    : locations

  // Totaux par lieu
  const totalByLocation = Object.fromEntries(
    locations.map((l) => [
      l.location_id,
      {
        total: l.items.length,
        checked: l.items.filter((i) => checks[itemKey(l.location_id, i.item)]).length,
      },
    ]),
  )

  const grandTotal = locations.reduce((n, l) => n + l.items.length, 0)
  const grandChecked = locations.reduce(
    (n, l) => n + l.items.filter((i) => checks[itemKey(l.location_id, i.item)]).length,
    0,
  )

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Liste de courses</h1>
          <p className="text-sm text-stone-500 mt-0.5">Semaine du {fmtDate(plan.weekStartDate)}</p>
        </div>
        <Link
          to={`/plan/${plan.id}`}
          className="text-sm text-stone-400 hover:text-stone-700 shrink-0"
        >
          ← Plan
        </Link>
      </div>

      {/* Progression globale */}
      <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-stone-600">
            {grandChecked} / {grandTotal} articles cochés
          </span>
          {grandChecked > 0 && (
            <button
              onClick={() => {
                setChecks({})
                if (id) saveChecks(id, {})
              }}
              className="text-xs text-stone-400 hover:text-red-500 transition-colors"
            >
              Tout décocher
            </button>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-stone-600 transition-all"
            style={{ width: grandTotal > 0 ? `${(grandChecked / grandTotal) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveLocation(null)}
          className={`rounded-full px-3 py-1 text-sm border transition-colors ${
            activeLocation === null
              ? 'bg-stone-800 text-white border-stone-800'
              : 'border-stone-300 text-stone-600 hover:bg-stone-50'
          }`}
        >
          Tous les lieux
        </button>
        {locations.map((l) => {
          const { total, checked } = totalByLocation[l.location_id]
          const done = checked === total
          return (
            <button
              key={l.location_id}
              onClick={() => setActiveLocation(l.location_id === activeLocation ? null : l.location_id)}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                activeLocation === l.location_id
                  ? 'bg-stone-800 text-white border-stone-800'
                  : done
                  ? 'border-stone-200 text-stone-400 bg-stone-50'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {l.location_name}
              <span className={`ml-1.5 text-xs ${activeLocation === l.location_id ? 'text-stone-300' : 'text-stone-400'}`}>
                {checked}/{total}
              </span>
            </button>
          )
        })}
        <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-sm text-stone-500">
          <input
            type="checkbox"
            checked={showUrgentOnly}
            onChange={(e) => setShowUrgentOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-stone-300"
          />
          Urgents seulement
        </label>
      </div>

      {/* Listes par lieu */}
      {displayedLocations.map((loc) => {
        const items = showUrgentOnly
          ? loc.items.filter((i) => i.freshness_urgency === 'day_of_cooking')
          : loc.items
        if (items.length === 0) return null

        const byCategory = items.reduce<Record<string, typeof items>>((acc, item) => {
          const cat = item.category ?? 'Autre'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push(item)
          return acc
        }, {})

        const { checked } = totalByLocation[loc.location_id]
        const allChecked = checked === loc.items.length

        return (
          <section key={loc.location_id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
              <h2 className="text-sm font-medium text-stone-800">{loc.location_name}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-400">
                  {totalByLocation[loc.location_id].checked}/{totalByLocation[loc.location_id].total}
                </span>
                {allChecked ? (
                  <button
                    onClick={() => resetLocation(loc.location_id, loc.items.map((i) => i.item))}
                    className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    Réinitialiser
                  </button>
                ) : null}
              </div>
            </div>

            <div className="divide-y divide-stone-50">
              {Object.entries(byCategory).map(([category, catItems]) => (
                <div key={category}>
                  <p className="px-4 py-1.5 text-xs text-stone-400 bg-stone-50/50 font-medium uppercase tracking-wide">
                    {category}
                  </p>
                  {catItems.map((item) => {
                    const key = itemKey(loc.location_id, item.item)
                    const checked = !!checks[key]
                    const urgent = item.freshness_urgency === 'day_of_cooking'
                    return (
                      <label
                        key={item.item}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          checked ? 'bg-stone-50' : 'hover:bg-stone-50/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(loc.location_id, item.item)}
                          className="h-4 w-4 rounded border-stone-300 text-stone-800 shrink-0"
                        />
                        <span className={`flex-1 text-sm ${checked ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                          {item.item}
                        </span>
                        <span className="text-xs text-stone-400 shrink-0">{item.qty}</span>
                        {urgent && !checked && (
                          <span className="text-xs text-amber-600 shrink-0" title="À acheter le jour de la cuisson">
                            frais
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {/* Suggestions renouvellement pantry */}
      {output.pantry_renewal_suggestions.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100">
            <h2 className="text-sm font-medium text-amber-800">Renouvellement garde-manger</h2>
          </div>
          <div className="divide-y divide-amber-100">
            {output.pantry_renewal_suggestions.map((s) => (
              <div key={s.pantry_target_id} className="flex items-start gap-3 px-4 py-3">
                <span className="text-sm text-amber-800 font-medium">{s.name}</span>
                <span className="text-xs text-amber-600 mt-0.5">{s.reason}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
