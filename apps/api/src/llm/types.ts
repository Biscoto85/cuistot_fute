// Types décrivant le contexte user chargé depuis la DB avant tout appel LLM.
// T10 est responsable de construire ce contexte ; T9 le consomme.

export type LlmUserContext = {
  user: {
    displayName: string
  }
  household: {
    adults: number
    children: number
    childrenAges: number[]
    description: string | null
  }
  preferences: {
    loves: string[]
    dislikes: string[]
    allergies: string[]
    currentPhase: string | null
    cookingComplexity: string
    dietRegime: string
    fishOk: boolean
    menuTier: string
    dietaryTargets: Record<string, string> | null
    localSpecialties: string | null
    notes: string | null
  }
  locations: Array<{
    id: string
    name: string
    kind: string
    notes: string | null
  }>
  pantryTargets: Array<{
    id: string
    name: string
    targetQuantity: string
    unit: string
    rotationMonths: number
    lastPurchasedAt: string | null
    priority: string
    stockStatus: string
  }>
  // Plans des 8 dernières semaines pour l'anti-répétition
  recentWeeklyMeals: Array<{
    weekStartDate: string
    mealLabels: string[]
  }>
  // 30 dernières notations (booster +1, éviter -1)
  recentRatings: Array<{
    mealLabel: string
    rating: number
    ratedAt: string
  }>
  // Plats favoris déclarés (is_favorite=true, max 20)
  favoriteMeals: Array<{
    mealLabel: string
  }>
}

export type LlmLogKind = 'generate_plan' | 'regenerate_with_feedback' | 'sandbox'

export type RegenerateContext = {
  feedback: string
  previousPlanOutput: import('@cuistot/shared').PlanOutput
}
