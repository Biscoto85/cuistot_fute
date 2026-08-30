// Éditeur des âges des enfants du foyer.
// Le nombre d'enfants est dérivé de la liste — pas de compteur séparé à maintenir.

const AGE_LABELS = (age: number) => (age === 0 ? 'Moins de 1 an' : `${age} ans`)

export function ChildrenAgesEditor({
  ages,
  onChange,
}: {
  ages: number[]
  onChange: (ages: number[]) => void
}) {
  function setAge(i: number, age: number) {
    onChange(ages.map((a, idx) => (idx === i ? age : a)))
  }

  function remove(i: number) {
    onChange(ages.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <label className="block text-sm text-stone-600 mb-1">Enfants (&lt; 13 ans et ados)</label>
      {ages.length === 0 && (
        <p className="text-xs text-stone-400 mb-2">Aucun enfant déclaré.</p>
      )}
      <div className="space-y-2">
        {ages.map((age, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-stone-400 w-16 shrink-0">Enfant {i + 1}</span>
            <select
              value={age}
              onChange={(e) => setAge(i, parseInt(e.target.value))}
              className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none bg-white"
            >
              {Array.from({ length: 18 }, (_, a) => (
                <option key={a} value={a}>{AGE_LABELS(a)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-stone-300 hover:text-red-400 text-lg leading-none px-1"
              title="Retirer cet enfant"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {ages.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...ages, 4])}
          className="mt-2 text-sm text-stone-500 hover:text-stone-800 underline underline-offset-2"
        >
          + Ajouter un enfant
        </button>
      )}
    </div>
  )
}
