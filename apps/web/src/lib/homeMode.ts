export type HomeMode =
  | 'to-generate'
  | 'shopping'
  | 'cooking'
  | 'weekday'
  | 'feedback-pending'

type Plan = {
  id: string
  weekStartDate: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
}

export function getHomeMode(today: Date, plans: Plan[]): { mode: HomeMode; plan: Plan | null } {
  const activePlan = plans.find((p) => p.status === 'draft' || p.status === 'active') ?? null

  if (!activePlan) return { mode: 'to-generate', plan: null }

  const weekStart = new Date(activePlan.weekStartDate + 'T00:00:00')
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // dimanche inclus

  // Plan de la semaine passée → générer la suivante
  if (today > weekEnd) {
    // Si le plan est active (= semaine vécue) et n'a pas encore été noté
    if (activePlan.status === 'active') return { mode: 'feedback-pending', plan: activePlan }
    return { mode: 'to-generate', plan: null }
  }

  const dow = today.getDay() // 0=dim, 1=lun…6=sam

  if (dow === 0) return { mode: 'cooking', plan: activePlan }
  if (dow === 5 || dow === 6) return { mode: 'shopping', plan: activePlan }
  return { mode: 'weekday', plan: activePlan }
}

// Retourne le lundi de la semaine suivante sous forme YYYY-MM-DD
export function nextMonday(today: Date): string {
  const d = new Date(today)
  const dow = d.getDay()
  const daysUntilMonday = dow === 0 ? 1 : 8 - dow
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().slice(0, 10)
}

// Formate une date YYYY-MM-DD en "lun. 12 mai"
export function fmtDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

// Retourne le nom du jour en français à partir d'une Date
export function todayDayLabel(today: Date): string {
  return today.toLocaleDateString('fr-FR', { weekday: 'long' })
}
