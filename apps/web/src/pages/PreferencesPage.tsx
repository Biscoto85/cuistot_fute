import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { LOCATION_KINDS, PANTRY_CATEGORIES, PANTRY_UNITS, PANTRY_PRIORITIES } from '@cuistot/shared'
import type { LocationKind, PantryCategory, PantryUnit, PantryPriority } from '@cuistot/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type Household = { id: string; adults: number; children: number; description: string | null }
type Location = { id: string; name: string; kind: LocationKind; notes: string | null; priority: number }
type Preferences = {
  id: string
  loves: string[]; dislikes: string[]; allergies: string[]
  currentPhase: string | null; dietaryTargets: Record<string, string> | null
  localSpecialties: string | null; notes: string | null
}
type PantryTarget = {
  id: string; name: string; category: PantryCategory; targetQuantity: string; unit: PantryUnit
  rotationMonths: number; priority: PantryPriority; lastPurchasedAt: string | null
  preferredLocationId: string | null; notes: string | null
}

type Tab = 'foyer' | 'lieux' | 'prefs' | 'pantry' | 'compte'

const TAB_LABELS: Record<Tab, string> = {
  foyer: 'Foyer', lieux: 'Lieux', prefs: 'Préférences', pantry: 'Garde-manger', compte: 'Compte',
}

const KIND_LABELS: Record<LocationKind, string> = {
  supermarche: 'Supermarché', bio: 'Bio', marche: 'Marché',
  primeur: 'Primeur', boucherie: 'Boucherie', fromagerie: 'Fromagerie', autre: 'Autre',
}

const CATEGORY_LABELS: Record<PantryCategory, string> = {
  cereales: 'Céréales', legumineuses: 'Légumineuses', conserves: 'Conserves',
  huiles_vinaigres: 'Huiles & Vinaigres', epices: 'Épices', condiments: 'Condiments',
  boissons: 'Boissons', sucres_farines: 'Sucres & Farines', secs_divers: 'Secs divers', autre: 'Autre',
}

// ─── Composant TagInput ───────────────────────────────────────────────────────

function TagInput({ label, tags, onChange, placeholder }: {
  label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
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
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
        <button type="button" onClick={add} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">Ajouter</button>
      </div>
    </div>
  )
}

// ─── Section Foyer ────────────────────────────────────────────────────────────

function FoyerSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['household'],
    queryFn: () => api.get<{ household: Household }>('/api/household'),
  })

  const [adults, setAdults] = useState<number | null>(null)
  const [children, setChildren] = useState<number | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const household = data?.household

  function getAdults() { return adults ?? household?.adults ?? 1 }
  function getChildren() { return children ?? household?.children ?? 0 }
  function getDescription() { return description ?? household?.description ?? '' }

  const mutation = useMutation({
    mutationFn: () => api.put('/api/household', {
      adults: getAdults(),
      children: getChildren(),
      description: getDescription() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['household'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-6">
        <div className="flex-1">
          <label className="block text-sm text-stone-600 mb-1">Adultes (≥ 13 ans)</label>
          <input type="number" min={1} max={10} value={getAdults()}
            onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-stone-600 mb-1">Enfants (&lt; 13 ans)</label>
          <input type="number" min={0} max={10} value={getChildren()}
            onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Description <span className="text-stone-400">(optionnel)</span></label>
        <input type="text" value={getDescription()}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Couple + 1 ado gros mangeur, peu de viande rouge"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="rounded-md bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-sm text-green-600">Enregistré</span>}
      </div>
    </div>
  )
}

// ─── Section Lieux ────────────────────────────────────────────────────────────

function LieuxSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ locations: Location[] }>('/api/locations'),
  })

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<LocationKind>('supermarche')
  const [newNotes, setNewNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Location>>({})
  const [error, setError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: () => api.post('/api/locations', { name: newName.trim(), kind: newKind, notes: newNotes.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] })
      setAdding(false); setNewName(''); setNewKind('supermarche'); setNewNotes('')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  const editMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/locations/${id}`, {
      name: editData.name, kind: editData.kind, notes: editData.notes ?? null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setEditingId(null) },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/locations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  })

  const locations = data?.locations ?? []
  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>

  return (
    <div className="space-y-3">
      {locations.map((loc) => (
        <div key={loc.id} className="rounded-lg border border-stone-200 p-3">
          {editingId === loc.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={editData.name ?? ''} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                  className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
                <select value={editData.kind ?? 'supermarche'} onChange={(e) => setEditData((d) => ({ ...d, kind: e.target.value as LocationKind }))}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
                  {LOCATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
              </div>
              <input type="text" value={editData.notes ?? ''} onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Notes"
                className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => editMutation.mutate(loc.id)} disabled={editMutation.isPending}
                  className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-50">
                  {editMutation.isPending ? '…' : 'Enregistrer'}
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-stone-400 hover:text-stone-700">Annuler</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-stone-800">{loc.name}</p>
                <p className="text-xs text-stone-400">{KIND_LABELS[loc.kind]}{loc.notes ? ` — ${loc.notes}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setEditingId(loc.id); setEditData({ name: loc.name, kind: loc.kind, notes: loc.notes ?? '' }) }}
                  className="text-xs text-stone-400 hover:text-stone-700">Modifier</button>
                <button onClick={() => deleteMutation.mutate(loc.id)} disabled={deleteMutation.isPending}
                  className="text-xs text-stone-300 hover:text-red-500">Supprimer</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-stone-200 p-3 space-y-2">
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du lieu" autoFocus
              className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as LocationKind)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
              {LOCATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optionnel)"
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={() => newName.trim() && addMutation.mutate()} disabled={addMutation.isPending || !newName.trim()}
              className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-50">
              {addMutation.isPending ? '…' : 'Ajouter'}
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-stone-400 hover:text-stone-700">Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-stone-500 hover:text-stone-800 underline underline-offset-2">
          + Ajouter un lieu
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ─── Section Préférences alimentaires ─────────────────────────────────────────

function PrefsSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get<{ preferences: Preferences }>('/api/preferences'),
  })

  const prefs = data?.preferences
  const [loves, setLoves] = useState<string[] | null>(null)
  const [dislikes, setDislikes] = useState<string[] | null>(null)
  const [allergies, setAllergies] = useState<string[] | null>(null)
  const [phase, setPhase] = useState<string | null>(null)
  const [localSpecialties, setLocalSpecialties] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const get = <T,>(local: T | null, remote: T | undefined, fallback: T): T =>
    local ?? remote ?? fallback

  const mutation = useMutation({
    mutationFn: () => api.put('/api/preferences', {
      loves: get(loves, prefs?.loves, []),
      dislikes: get(dislikes, prefs?.dislikes, []),
      allergies: get(allergies, prefs?.allergies, []),
      current_phase: get(phase, prefs?.currentPhase, '') || null,
      local_specialties: get(localSpecialties, prefs?.localSpecialties, '') || null,
      notes: get(notes, prefs?.notes, '') || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferences'] })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>

  return (
    <div className="space-y-5">
      <TagInput label="J'adore" tags={get(loves, prefs?.loves, [])}
        onChange={setLoves} placeholder="poulet rôti, pâtes…" />
      <TagInput label="Je n'aime pas" tags={get(dislikes, prefs?.dislikes, [])}
        onChange={setDislikes} placeholder="betterave, abats…" />
      <TagInput label="Allergies / intolérances" tags={get(allergies, prefs?.allergies, [])}
        onChange={setAllergies} placeholder="noix, lactose…" />
      <div>
        <label className="block text-sm text-stone-600 mb-1">Phase actuelle <span className="text-stone-400">(optionnel)</span></label>
        <input type="text" value={get(phase, prefs?.currentPhase, '') ?? ''}
          onChange={(e) => setPhase(e.target.value)}
          placeholder="moins de viande rouge, phase sport…"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Spécialités locales</label>
        <textarea value={get(localSpecialties, prefs?.localSpecialties, '') ?? ''}
          onChange={(e) => setLocalSpecialties(e.target.value)}
          placeholder="huile olive 5L Biocoop, fromages chèvre M. Dupuis…"
          rows={2}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none" />
      </div>
      <div>
        <label className="block text-sm text-stone-600 mb-1">Notes libres</label>
        <textarea value={get(notes, prefs?.notes, '') ?? ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Toute info utile pour personnaliser les plans…"
          rows={3}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none resize-none" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="rounded-md bg-stone-800 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50 transition-colors">
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && <span className="text-sm text-green-600">Enregistré</span>}
      </div>
    </div>
  )
}

// ─── Section Garde-manger ─────────────────────────────────────────────────────

function PantrySection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['pantry-targets'],
    queryFn: () => api.get<{ targets: PantryTarget[] }>('/api/pantry-targets'),
  })

  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', category: 'cereales' as PantryCategory, targetQuantity: '', unit: 'kg' as PantryUnit, priority: 'essentiel' as PantryPriority, rotationMonths: '6' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<PantryTarget & { targetQuantity: string }>>({})
  const [error, setError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: () => api.post('/api/pantry-targets', {
      name: newItem.name.trim(),
      category: newItem.category,
      targetQuantity: parseFloat(newItem.targetQuantity),
      unit: newItem.unit,
      priority: newItem.priority,
      rotationMonths: parseInt(newItem.rotationMonths) || 6,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry-targets'] })
      setAdding(false)
      setNewItem({ name: '', category: 'cereales', targetQuantity: '', unit: 'kg', priority: 'essentiel', rotationMonths: '6' })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  const editMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/pantry-targets/${id}`, {
      name: editData.name,
      category: editData.category,
      targetQuantity: parseFloat(editData.targetQuantity ?? '0'),
      unit: editData.unit,
      priority: editData.priority,
      rotationMonths: editData.rotationMonths,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pantry-targets'] }); setEditingId(null) },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  const restockedMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/pantry-targets/${id}/restocked`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry-targets'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/pantry-targets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry-targets'] }),
  })

  const targets = data?.targets ?? []
  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>

  return (
    <div className="space-y-3">
      {targets.map((t) => (
        <div key={t.id} className="rounded-lg border border-stone-200 p-3">
          {editingId === t.id ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="text" value={editData.name ?? ''} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                  className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:border-stone-500" />
                <select value={editData.category ?? 'cereales'} onChange={(e) => setEditData((d) => ({ ...d, category: e.target.value as PantryCategory }))}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
                  {PANTRY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input type="number" value={editData.targetQuantity ?? ''} onChange={(e) => setEditData((d) => ({ ...d, targetQuantity: e.target.value }))}
                  placeholder="Qté" className="w-20 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:border-stone-500" />
                <select value={editData.unit ?? 'kg'} onChange={(e) => setEditData((d) => ({ ...d, unit: e.target.value as PantryUnit }))}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
                  {PANTRY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={editData.priority ?? 'essentiel'} onChange={(e) => setEditData((d) => ({ ...d, priority: e.target.value as PantryPriority }))}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
                  {PANTRY_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" value={editData.rotationMonths ?? 6} onChange={(e) => setEditData((d) => ({ ...d, rotationMonths: parseInt(e.target.value) || 6 }))}
                  placeholder="Rot." title="Rotation (mois)"
                  className="w-16 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:border-stone-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => editMutation.mutate(t.id)} disabled={editMutation.isPending}
                  className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-50">
                  {editMutation.isPending ? '…' : 'Enregistrer'}
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-stone-400 hover:text-stone-700">Annuler</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-stone-800">{t.name}</p>
                <p className="text-xs text-stone-400">
                  {t.targetQuantity} {t.unit} · {CATEGORY_LABELS[t.category]} · {t.priority}
                  {t.lastPurchasedAt && ` · acheté ${t.lastPurchasedAt}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <button onClick={() => restockedMutation.mutate(t.id)} disabled={restockedMutation.isPending}
                  className="text-xs text-stone-400 hover:text-green-600 transition-colors" title="Marquer comme réapprovisionné">
                  Réappro
                </button>
                <button onClick={() => { setEditingId(t.id); setEditData({ name: t.name, category: t.category, targetQuantity: t.targetQuantity, unit: t.unit, priority: t.priority, rotationMonths: t.rotationMonths }) }}
                  className="text-xs text-stone-400 hover:text-stone-700">Modifier</button>
                <button onClick={() => deleteMutation.mutate(t.id)} disabled={deleteMutation.isPending}
                  className="text-xs text-stone-300 hover:text-red-500">Supprimer</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-stone-200 p-3 space-y-2">
          <input type="text" value={newItem.name} onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
            placeholder="Nom (ex: Riz basmati)" autoFocus
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none" />
          <div className="flex gap-2 flex-wrap">
            <select value={newItem.category} onChange={(e) => setNewItem((s) => ({ ...s, category: e.target.value as PantryCategory }))}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
              {PANTRY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <input type="number" value={newItem.targetQuantity} onChange={(e) => setNewItem((s) => ({ ...s, targetQuantity: e.target.value }))}
              placeholder="Qté" className="w-20 rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:border-stone-500" />
            <select value={newItem.unit} onChange={(e) => setNewItem((s) => ({ ...s, unit: e.target.value as PantryUnit }))}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
              {PANTRY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={newItem.priority} onChange={(e) => setNewItem((s) => ({ ...s, priority: e.target.value as PantryPriority }))}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
              {PANTRY_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => newItem.name.trim() && newItem.targetQuantity && addMutation.mutate()}
              disabled={addMutation.isPending || !newItem.name.trim() || !newItem.targetQuantity}
              className="rounded-md bg-stone-800 px-3 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-50">
              {addMutation.isPending ? '…' : 'Ajouter'}
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-stone-400 hover:text-stone-700">Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-stone-500 hover:text-stone-800 underline underline-offset-2">
          + Ajouter un article
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ─── Section Compte (RGPD) ────────────────────────────────────────────────────

function CompteSection() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/users/me/export', { credentials: 'include' })
      if (!res.ok) throw new Error('Export échoué')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cuistot-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<void>('/api/users/me', { password }),
    onSuccess: async () => {
      await logout()
      navigate('/login')
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur.'),
  })

  return (
    <div className="space-y-6">
      {/* Export */}
      <div>
        <h3 className="text-sm font-medium text-stone-800 mb-1">Export de vos données</h3>
        <p className="text-xs text-stone-500 mb-3">
          Téléchargez un fichier JSON contenant toutes vos données : profil, préférences,
          plans générés, notations.
        </p>
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors"
        >
          {exportMutation.isPending ? 'Export en cours…' : 'Télécharger mes données'}
        </button>
        {exportMutation.isError && <p className="mt-1 text-xs text-red-500">Export échoué.</p>}
      </div>

      <hr className="border-stone-100" />

      {/* Suppression */}
      <div>
        <h3 className="text-sm font-medium text-stone-800 mb-1">Supprimer mon compte</h3>
        <p className="text-xs text-stone-500 mb-3">
          Supprime définitivement votre compte et toutes vos données. Cette action est irréversible.
        </p>
        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm text-red-700 font-medium">Confirmez avec votre mot de passe</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe actuel"
              autoFocus
              className="w-full rounded-md border border-red-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none bg-white"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending || !password}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
              <button onClick={() => { setConfirmOpen(false); setError(null); setPassword('') }}
                className="text-sm text-stone-500 hover:text-stone-700">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      <hr className="border-stone-100" />

      <div>
        <Link to="/legal" className="text-sm text-stone-400 hover:text-stone-700 underline underline-offset-2">
          Mentions légales & confidentialité
        </Link>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function PreferencesPage() {
  const [tab, setTab] = useState<Tab>('foyer')

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Préférences</h1>

      {/* Onglets */}
      <div className="flex border-b border-stone-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-stone-800 text-stone-800 font-medium'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        {tab === 'foyer' && <FoyerSection />}
        {tab === 'lieux' && <LieuxSection />}
        {tab === 'prefs' && <PrefsSection />}
        {tab === 'pantry' && <PantrySection />}
        {tab === 'compte' && <CompteSection />}
      </div>
    </div>
  )
}
