import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DAYS_OF_WEEK, DESSERT_MODES } from '@cuistot/shared'
import type { DessertMode } from '@cuistot/shared'
import { api, ApiError } from '@/lib/api'
import { nextMonday } from '@/lib/homeMode'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  weekStartDate: string
  cravings: string
  surpriseMode: boolean
  includeBreakfast: boolean
  includeSnacks: boolean
  dessertMode: DessertMode
  sundayPrepCount: 2 | 3 | 4
  sundayTimeMin: number
  weekdayMaxAssemblyMin: 10 | 15 | 20 | 30
  coveredSlots: Set<string>
  budgetEur: string
  freeNote: string
}

const STORAGE_KEY = 'cuistot-generate-prefs'

// ─── Valeurs par défaut + localStorage ───────────────────────────────────────

function defaultSlots(): Set<string> {
  const slots = new Set<string>()
  for (const day of DAYS_OF_WEEK) {
    if (day !== 'dimanche') {
      slots.add(`${day}-midi`)
      slots.add(`${day}-soir`)
    }
  }
  return slots
}

function loadPrefs(): Partial<FormState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed.coveredSlots) parsed.coveredSlots = new Set(parsed.coveredSlots)
    return parsed
  } catch {
    return {}
  }
}

function savePrefs(state: FormState) {
  try {
    const toStore = { ...state, coveredSlots: Array.from(state.coveredSlots) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch { /* ignore */ }
}

function initialState(): FormState {
  const prefs = loadPrefs()
  const base: FormState = {
    weekStartDate: nextMonday(new Date()),
    cravings: '',
    surpriseMode: false,
    includeBreakfast: true,
    includeSnacks: false,
    dessertMode: 'aucun',
    sundayPrepCount: 3,
    sundayTimeMin: 120,
    weekdayMaxAssemblyMin: 15,
    coveredSlots: defaultSlots(),
    budgetEur: '',
    freeNote: '',
    ...prefs,
  }
  // weekStartDate toujours recalculé (ne pas restaurer une date passée)
  base.weekStartDate = nextMonday(new Date())
  return base
}

// ─── Composants ────────────────────────────────────────────────────────────────

function SlotGrid({
  slots,
  onChange,
}: {
  slots: Set<string>
  onChange: (slots: Set<string>) => void
}) {
  function toggle(slot: string) {
    const next = new Set(slots)
    if (next.has(slot)) next.delete(slot)
    else next.add(slot)
    onChange(next)
  }

  function toggleDay(day: string) {
    const midi = `${day}-midi`
    const soir = `${day}-soir`
    const allOn = slots.has(midi) && slots.has(soir)
    const next = new Set(slots)
    if (allOn) { next.delete(midi); next.delete(soir) }
    else { next.add(midi); next.add(soir) }
    onChange(next)
  }

  const DAY_LABELS: Record<string, string> = {
    lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
    jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs text-stone-400 font-normal pb-1 pr-3 w-12"></th>
            {DAYS_OF_WEEK.map((day) => (
              <th key={day} className="text-center pb-1">
                <button
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="text-xs text-stone-500 hover:text-stone-800 font-normal"
                >
                  {DAY_LABELS[day]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['midi', 'soir'] as const).map((period) => (
            <tr key={period}>
              <td className="text-xs text-stone-400 pr-3 py-1">{period}</td>
              {DAYS_OF_WEEK.map((day) => {
                const slot = `${day}-${period}`
                return (
                  <td key={day} className="text-center py-1">
                    <input
                      type="checkbox"
                      checked={slots.has(slot)}
                      onChange={() => toggle(slot)}
                      className="h-4 w-4 rounded border-stone-300 text-stone-800"
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function GeneratePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.coveredSlots.size === 0) {
      setError('Sélectionnez au moins un créneau.')
      return
    }
    setError(null)
    setLoading(true)
    savePrefs(form)

    try {
      const body = {
        week_start_date: form.weekStartDate,
        covered_slots: Array.from(form.coveredSlots),
        cravings: form.cravings || undefined,
        surprise_mode: form.surpriseMode,
        include_breakfast: form.includeBreakfast,
        include_snacks: form.includeSnacks,
        dessert_mode: form.dessertMode,
        sunday_prep_count: form.sundayPrepCount,
        sunday_time_min: form.sundayTimeMin,
        weekday_max_assembly_min: form.weekdayMaxAssemblyMin,
        budget_eur: form.budgetEur ? parseFloat(form.budgetEur) : undefined,
        free_note: form.freeNote || undefined,
      }
      const data = await api.post<{ plan: { id: string } }>('/api/plans/generate', body)
      navigate(`/plan/${data.plan.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  const sundayTimeOptions = [60, 90, 120, 150, 180, 210] as const
  const assemblyOptions = [10, 15, 20, 30] as const

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-stone-800 mb-6">Nouveau plan de la semaine</h1>

      {loading && (
        <div className="mb-6 rounded-lg border border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-500">
          Génération en cours — cela peut prendre 20 à 40 secondes…
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Semaine */}
        <section>
          <label className="block text-sm font-medium text-stone-700 mb-1">Semaine (lundi)</label>
          <input
            type="date"
            value={form.weekStartDate}
            onChange={(e) => update('weekStartDate', e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
          />
        </section>

        {/* Créneaux */}
        <section>
          <p className="text-sm font-medium text-stone-700 mb-2">Créneaux à couvrir</p>
          <SlotGrid slots={form.coveredSlots} onChange={(s) => update('coveredSlots', s)} />
        </section>

        {/* Envies */}
        <section className="space-y-3">
          <p className="text-sm font-medium text-stone-700">Envies cette semaine</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.surpriseMode}
              onChange={(e) => update('surpriseMode', e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span className="text-sm text-stone-600">Mode surprise — laisse le LLM choisir</span>
          </label>
          {!form.surpriseMode && (
            <input
              type="text"
              value={form.cravings}
              onChange={(e) => update('cravings', e.target.value)}
              placeholder="agneau, pasta carbonara, quelque chose de léger…"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
            />
          )}
        </section>

        {/* Dimanche */}
        <section className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Temps dispo dimanche</label>
            <div className="flex flex-wrap gap-2">
              {sundayTimeOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('sundayTimeMin', t)}
                  className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
                    form.sundayTimeMin === t
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {t < 60 ? `${t}min` : `${t / 60}h`}{t === 210 ? '+' : ''}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Prépas dimanche</label>
            <div className="flex gap-2">
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update('sundayPrepCount', n)}
                  className={`rounded-md px-4 py-1.5 text-sm border transition-colors ${
                    form.sundayPrepCount === n
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Semaine */}
        <section>
          <label className="block text-sm font-medium text-stone-700 mb-2">Temps max assemblage en semaine</label>
          <div className="flex gap-2">
            {assemblyOptions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update('weekdayMaxAssemblyMin', t)}
                className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
                  form.weekdayMaxAssemblyMin === t
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {t} min
              </button>
            ))}
          </div>
        </section>

        {/* Options */}
        <section className="space-y-3">
          <p className="text-sm font-medium text-stone-700">Options</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.includeBreakfast}
              onChange={(e) => update('includeBreakfast', e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span className="text-sm text-stone-600">Inclure le petit-déjeuner</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.includeSnacks}
              onChange={(e) => update('includeSnacks', e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span className="text-sm text-stone-600">Inclure les goûters</span>
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-stone-600 shrink-0">Desserts</span>
            <div className="flex gap-2">
              {DESSERT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update('dessertMode', m)}
                  className={`rounded-md px-3 py-1.5 text-sm border transition-colors ${
                    form.dessertMode === m
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {m === 'aucun' ? 'Aucun' : m === 'simple' ? 'Simple' : 'Gourmand'}
                </button>
              ))}
            </div>
            <span className="text-xs text-stone-400">
              {form.dessertMode === 'simple' && 'Fruits et laitages de saison'}
              {form.dessertMode === 'gourmand' && 'Avec une pâtisserie du dimanche'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-stone-600 shrink-0">Budget cible</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={form.budgetEur}
                onChange={(e) => update('budgetEur', e.target.value)}
                placeholder="80"
                min={10}
                className="w-20 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
              />
              <span className="text-sm text-stone-400">€</span>
            </div>
          </div>
        </section>

        {/* Note libre */}
        <section>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Note libre <span className="text-stone-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={form.freeNote}
            onChange={(e) => update('freeNote', e.target.value)}
            placeholder="j'ai des invités jeudi soir, semaine légère, on part vendredi…"
            rows={2}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none"
          />
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-stone-800 px-6 py-2.5 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Génération…' : 'Générer le plan'}
        </button>
      </form>
    </div>
  )
}
