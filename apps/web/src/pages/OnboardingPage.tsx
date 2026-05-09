import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { api, ApiError } from '@/lib/api'
import { LOCATION_KINDS } from '@cuistot/shared'
import type { LocationKind } from '@cuistot/shared'

// ─── Types locaux ──────────────────────────────────────────────────────────────

type LocationDraft = { name: string; kind: LocationKind; notes: string }

type WizardState = {
  // Étape 1 — Foyer
  adults: number
  children: number
  householdDescription: string
  // Étape 2 — Lieux
  locations: LocationDraft[]
  // Étape 3 — Préférences
  loves: string[]
  dislikes: string[]
  allergies: string[]
  currentPhase: string
  cookingComplexity: string
  // Étape 4 — Garde-manger
  pantryTargets: PantryDraft[]
  // Étape 5 — Notes
  localSpecialties: string
  notes: string
}

type PantryDraft = {
  name: string
  category: string
  targetQuantity: number
  unit: string
  priority: 'essentiel' | 'secondaire'
  selected: boolean
}

const KIND_LABELS: Record<LocationKind, string> = {
  supermarche: 'Supermarché',
  bio: 'Bio',
  marche: 'Marché',
  primeur: 'Primeur',
  boucherie: 'Boucherie',
  fromagerie: 'Fromagerie',
  autre: 'Autre',
}

const DEFAULT_PANTRY: Omit<PantryDraft, 'selected'>[] = [
  { name: 'Riz basmati', category: 'cereales', targetQuantity: 1.5, unit: 'kg', priority: 'essentiel' },
  { name: 'Pâtes sèches', category: 'cereales', targetQuantity: 1, unit: 'kg', priority: 'essentiel' },
  { name: 'Lentilles vertes', category: 'legumineuses', targetQuantity: 1, unit: 'kg', priority: 'essentiel' },
  { name: 'Pois chiches secs', category: 'legumineuses', targetQuantity: 500, unit: 'g', priority: 'essentiel' },
  { name: 'Conserves tomates pelées', category: 'conserves', targetQuantity: 6, unit: 'boites', priority: 'essentiel' },
  { name: 'Huile d\'olive extra-vierge', category: 'huiles_vinaigres', targetQuantity: 1, unit: 'L', priority: 'essentiel' },
  { name: 'Vinaigre balsamique', category: 'huiles_vinaigres', targetQuantity: 1, unit: 'pieces', priority: 'secondaire' },
  { name: 'Farine T65', category: 'sucres_farines', targetQuantity: 1, unit: 'kg', priority: 'secondaire' },
]

const STEP_LABELS = ['Foyer', 'Lieux', 'Préférences', 'Garde-manger', 'Notes']

// ─── Composants réutilisables ─────────────────────────────────────────────────

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-700">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-stone-400 hover:text-stone-700">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
        />
        <button type="button" onClick={add} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">Ajouter</button>
      </div>
    </div>
  )
}

// ─── Wizard principal ─────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [state, setState] = useState<WizardState>({
    adults: 1,
    children: 0,
    householdDescription: '',
    locations: [{ name: '', kind: 'supermarche', notes: '' }],
    loves: [],
    dislikes: [],
    allergies: [],
    currentPhase: '',
    cookingComplexity: 'intermediate',
    pantryTargets: DEFAULT_PANTRY.map((p) => ({ ...p, selected: true })),
    localSpecialties: '',
    notes: '',
  })

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  // ── Sauvegarde par étape ──────────────────────────────────────────────────

  async function saveStep1() {
    await api.put('/api/household', {
      adults: state.adults,
      children: state.children,
      description: state.householdDescription || null,
    })
  }

  async function saveStep2() {
    const filled = state.locations.filter((l) => l.name.trim())
    if (filled.length === 0) throw new Error('Ajoutez au moins un lieu de courses.')
    for (const loc of filled) {
      await api.post('/api/locations', { name: loc.name.trim(), kind: loc.kind, notes: loc.notes.trim() || null })
    }
  }

  async function saveStep3() {
    await api.put('/api/preferences', {
      loves: state.loves,
      dislikes: state.dislikes,
      allergies: state.allergies,
      current_phase: state.currentPhase || null,
      cooking_complexity: state.cookingComplexity,
    })
  }

  async function saveStep4() {
    const selected = state.pantryTargets.filter((p) => p.selected)
    if (selected.length === 0) return
    await api.post('/api/pantry-targets/bulk-init', {
      targets: selected.map(({ selected: _s, ...p }) => p),
    })
  }

  async function saveStep5AndFinalize() {
    if (state.localSpecialties || state.notes) {
      await api.put('/api/preferences', {
        local_specialties: state.localSpecialties || null,
        notes: state.notes || null,
      })
    }
    await api.put('/api/auth/onboarding', {})
    await refresh()
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async function handleNext() {
    setError(null)
    setLoading(true)
    try {
      if (step === 0) await saveStep1()
      if (step === 1) await saveStep2()
      if (step === 2) await saveStep3()
      if (step === 3) await saveStep4()
      if (step === 4) {
        await saveStep5AndFinalize()
        navigate('/app', { replace: true })
        return
      }
      setStep((s) => s + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Erreur.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    if (step === 4) {
      setLoading(true)
      try {
        await api.put('/api/auth/onboarding', {})
        await refresh()
        navigate('/app', { replace: true })
      } catch {
        navigate('/app', { replace: true })
      } finally {
        setLoading(false)
      }
      return
    }
    setStep((s) => s + 1)
  }

  // ── Rendu par étape ────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-stone-50">
      <div className="m-auto w-full max-w-lg px-4 py-12">
        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-2 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                i === step ? 'bg-stone-800 text-white' : i < step ? 'bg-stone-300 text-stone-600' : 'border border-stone-300 text-stone-400'
              }`}>{i + 1}</div>
              {i < STEP_LABELS.length - 1 && <div className={`h-px w-6 ${i < step ? 'bg-stone-300' : 'bg-stone-200'}`} />}
            </div>
          ))}
          <span className="ml-2 text-sm text-stone-500">{STEP_LABELS[step]}</span>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
          {step === 0 && <Step1Foyer state={state} update={update} />}
          {step === 1 && <Step2Lieux state={state} update={update} />}
          {step === 2 && <Step3Prefs state={state} update={update} />}
          {step === 3 && <Step4Pantry state={state} update={update} />}
          {step === 4 && <Step5Notes state={state} update={update} />}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <button onClick={() => setStep((s) => s - 1)} className="text-sm text-stone-400 hover:text-stone-700">Retour</button>
            ) : <span />}
            <div className="flex gap-3">
              {step >= 3 && step < 4 && (
                <button onClick={handleSkip} className="text-sm text-stone-400 hover:text-stone-700">Passer</button>
              )}
              {step === 4 && (
                <button onClick={handleSkip} disabled={loading} className="text-sm text-stone-400 hover:text-stone-700">Passer</button>
              )}
              <button
                onClick={handleNext}
                disabled={loading}
                className="rounded-md bg-stone-800 px-5 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Enregistrement…' : step === 4 ? 'Terminer' : 'Continuer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Étape 1 — Foyer ──────────────────────────────────────────────────────────

function Step1Foyer({ state, update }: { state: WizardState; update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold text-stone-800">Votre foyer</h2>
      <div className="flex gap-6">
        <div className="flex-1">
          <label className="block text-sm text-stone-600 mb-1">Adultes (≥ 13 ans)</label>
          <select value={state.adults} onChange={(e) => update('adults', parseInt(e.target.value))}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white">
            {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-stone-600 mb-1">Enfants (&lt; 13 ans)</label>
          <select value={state.children} onChange={(e) => update('children', parseInt(e.target.value))}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white">
            {[0,1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Description libre <span className="text-stone-400">(optionnel)</span></label>
        <input type="text" value={state.householdDescription}
          onChange={(e) => update('householdDescription', e.target.value)}
          placeholder="Ex : couple + 1 ado gros mangeur, peu de viande rouge"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
      </div>
    </>
  )
}

// ─── Étape 2 — Lieux ──────────────────────────────────────────────────────────

function Step2Lieux({ state, update }: { state: WizardState; update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  function addLocation() {
    update('locations', [...state.locations, { name: '', kind: 'supermarche', notes: '' }])
  }

  function updateLoc(i: number, field: keyof LocationDraft, value: string) {
    const updated = state.locations.map((l, idx) => idx === i ? { ...l, [field]: value } : l)
    update('locations', updated)
  }

  function removeLoc(i: number) {
    update('locations', state.locations.filter((_, idx) => idx !== i))
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-stone-800">Lieux de courses</h2>
      <p className="text-sm text-stone-500">Au moins un lieu requis.</p>
      <div className="space-y-4">
        {state.locations.map((loc, i) => (
          <div key={i} className="rounded-lg border border-stone-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input type="text" value={loc.name} onChange={(e) => updateLoc(i, 'name', e.target.value)}
                placeholder="Nom du lieu (ex: Intermarché Senlis)"
                className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
              <select value={loc.kind} onChange={(e) => updateLoc(i, 'kind', e.target.value as LocationKind)}
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-stone-500 focus:outline-none">
                {LOCATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
              {state.locations.length > 1 && (
                <button type="button" onClick={() => removeLoc(i)} className="text-stone-300 hover:text-red-400 text-lg leading-none">×</button>
              )}
            </div>
            <input type="text" value={loc.notes} onChange={(e) => updateLoc(i, 'notes', e.target.value)}
              placeholder="Notes (ex: bons légumes secs, fermé lundi)"
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
          </div>
        ))}
      </div>
      <button type="button" onClick={addLocation}
        className="text-sm text-stone-500 hover:text-stone-800 underline underline-offset-2">
        + Ajouter un lieu
      </button>
    </>
  )
}

// ─── Étape 3 — Préférences ────────────────────────────────────────────────────

function Step3Prefs({ state, update }: { state: WizardState; update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold text-stone-800">Préférences alimentaires</h2>
      <TagInput label="J'adore" tags={state.loves} onChange={(v) => update('loves', v)} placeholder="poulet rôti, pâtes, sushis…" />
      <TagInput label="Je n'aime pas" tags={state.dislikes} onChange={(v) => update('dislikes', v)} placeholder="betterave, abats…" />
      <TagInput label="Allergies / intolérances" tags={state.allergies} onChange={(v) => update('allergies', v)} placeholder="noix, lactose, gluten…" />
      <div>
        <label className="block text-sm text-stone-600 mb-1">Phase actuelle <span className="text-stone-400">(optionnel)</span></label>
        <input type="text" value={state.currentPhase}
          onChange={(e) => update('currentPhase', e.target.value)}
          placeholder="Ex : moins de viande rouge, phase sport"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Complexité culinaire souhaitée</label>
        <select value={state.cookingComplexity} onChange={(e) => update('cookingComplexity', e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none bg-white">
          <option value="simple">Simple — plats rapides, techniques de base</option>
          <option value="intermediate">Intermédiaire — techniques variées, quelques préparations élaborées</option>
          <option value="elaborate">Élaboré — techniques avancées, préparations longues bienvenues</option>
        </select>
      </div>
    </>
  )
}

// ─── Étape 4 — Garde-manger ───────────────────────────────────────────────────

function Step4Pantry({ state, update }: { state: WizardState; update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  function toggleItem(i: number) {
    const updated = state.pantryTargets.map((p, idx) => idx === i ? { ...p, selected: !p.selected } : p)
    update('pantryTargets', updated)
  }

  function updateQty(i: number, value: string) {
    const updated = state.pantryTargets.map((p, idx) =>
      idx === i ? { ...p, targetQuantity: parseFloat(value) || p.targetQuantity } : p
    )
    update('pantryTargets', updated)
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-stone-800">Cibles garde-manger</h2>
      <p className="text-sm text-stone-500">Décochez ce que vous n'utilisez pas, ajustez les quantités.</p>
      <div className="space-y-2">
        {state.pantryTargets.map((item, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-md px-3 py-2 ${item.selected ? 'bg-stone-50' : 'opacity-40'}`}>
            <input type="checkbox" checked={item.selected} onChange={() => toggleItem(i)}
              className="h-4 w-4 rounded border-stone-300 text-stone-800" />
            <span className="flex-1 text-sm text-stone-700">{item.name}</span>
            <input type="number" value={item.targetQuantity} min={0.1} step={0.5}
              onChange={(e) => updateQty(i, e.target.value)}
              disabled={!item.selected}
              className="w-16 rounded border border-stone-300 px-2 py-0.5 text-sm text-right focus:outline-none" />
            <span className="text-sm text-stone-400 w-10">{item.unit}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Étape 5 — Notes ──────────────────────────────────────────────────────────

function Step5Notes({ state, update }: { state: WizardState; update: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold text-stone-800">Spécialités et notes</h2>
      <p className="text-sm text-stone-500">Tout ce que le LLM doit savoir de particulier sur vos courses ou habitudes. Complètement optionnel.</p>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Spécialités locales</label>
        <textarea value={state.localSpecialties}
          onChange={(e) => update('localSpecialties', e.target.value)}
          placeholder="Ex : huile olive 5L Biocoop, miel de Picardie, fromages de chèvre chez M. Dupuis"
          rows={3}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none" />
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Autres notes</label>
        <textarea value={state.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Tout ce qui peut aider à personnaliser les plans…"
          rows={3}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none" />
      </div>
    </>
  )
}
