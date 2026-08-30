import type { GeneratePlanInput, PlanOutput } from '@cuistot/shared'
import { PROMPT_VERSION, SYSTEM_PROMPT_TEMPLATE } from './prompts/system-v5'
import { getSeasonalProduce } from './seasons'
import type { LlmUserContext } from './types'

export { PROMPT_VERSION }

// ─── Formatters internes ──────────────────────────────────────────────────────

function fmt(arr: string[]): string {
  return arr.length > 0 ? arr.join(', ') : 'aucun'
}

function fmtLocations(locs: LlmUserContext['locations']): string {
  if (locs.length === 0) return 'Aucun lieu renseigné.'
  return locs
    .map((l, i) => {
      const notes = l.notes ? ` — ${l.notes}` : ''
      return `${i + 1}. ${l.name} (${l.kind}, id: ${l.id})${notes}`
    })
    .join('\n')
}

function fmtPantry(targets: LlmUserContext['pantryTargets']): string {
  if (targets.length === 0) return 'Aucune cible garde-manger renseignée.'
  return targets
    .map((t) => {
      const lastBought = t.lastPurchasedAt
        ? `dernier achat ${t.lastPurchasedAt}`
        : 'jamais acheté'
      return `- ${t.name} : stock ${t.stockStatus}, priorité ${t.priority}, cible ${t.targetQuantity} ${t.unit}, rotation ${t.rotationMonths} mois, ${lastBought} (id: ${t.id})`
    })
    .join('\n')
}

function fmtRecentMeals(weeks: LlmUserContext['recentWeeklyMeals']): string {
  if (weeks.length === 0) return 'Aucun historique disponible.'
  return weeks
    .map((w) => `Semaine du ${w.weekStartDate} : ${w.mealLabels.join(', ')}`)
    .join('\n')
}

function fmtRatings(ratings: LlmUserContext['recentRatings']): string {
  if (ratings.length === 0) return 'Aucune notation disponible.'
  return ratings
    .map((r) => {
      const label = r.rating === 1 ? '+1' : r.rating === -1 ? '-1' : '0'
      return `${r.mealLabel} (${label}, ${r.ratedAt})`
    })
    .join('\n')
}

function fmtFavorites(favs: LlmUserContext['favoriteMeals']): string {
  if (favs.length === 0) return 'Aucun favori déclaré.'
  return favs.map((f) => f.mealLabel).join(', ')
}

const COMPLEXITY_LABELS: Record<string, string> = {
  simple: 'Simple',
  intermediate: 'Intermédiaire',
  elaborate: 'Élaboré',
}

const REGIME_LABELS: Record<string, string> = {
  vegetarien: 'végétarien',
  flexitarien: 'flexitarien',
  carnivore: 'carnivore',
}

const TIER_LABELS: Record<string, string> = {
  economique: 'économique',
  normal: 'normal',
  luxe: 'luxe',
}

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: LlmUserContext, inputs: GeneratePlanInput): string {
  // Extraire le mois depuis week_start_date (format YYYY-MM-DD)
  const month = parseInt(inputs.week_start_date.slice(5, 7), 10)
  const { name: monthName, text: seasonalText } = getSeasonalProduce(month)
  const complexityLabel = COMPLEXITY_LABELS[ctx.preferences.cookingComplexity] ?? 'Intermédiaire'
  const regimeLabel = REGIME_LABELS[ctx.preferences.dietRegime] ?? 'flexitarien'
  const tierLabel = TIER_LABELS[ctx.preferences.menuTier] ?? 'normal'
  const fishRule = ctx.preferences.fishOk ? 'autorisés' : 'NON autorisés'

  const childrenDetail = ctx.household.children > 0
    ? ctx.household.childrenAges.length > 0
      ? `${ctx.household.children} enfant(s) (âges : ${ctx.household.childrenAges.join(', ')} ans)`
      : `${ctx.household.children} enfant(s) de moins de 13 ans`
    : 'aucun enfant'

  return SYSTEM_PROMPT_TEMPLATE
    .replace('{{display_name}}', ctx.user.displayName)
    .replace('{{adults}}', String(ctx.household.adults))
    .replace('{{children_detail}}', childrenDetail)
    .replace('{{household_description}}', ctx.household.description ?? '(pas de description)')
    .replace('{{loves}}', fmt(ctx.preferences.loves))
    .replace('{{dislikes}}', fmt(ctx.preferences.dislikes))
    .replace('{{allergies}}', fmt(ctx.preferences.allergies))
    .replace('{{current_phase}}', ctx.preferences.currentPhase ?? 'non renseignée')
    .replace('{{dietary_targets}}', ctx.preferences.dietaryTargets
      ? Object.entries(ctx.preferences.dietaryTargets).map(([k, v]) => `${k}: ${v}`).join(', ')
      : 'aucune')
    .replace('{{local_specialties}}', ctx.preferences.localSpecialties ?? 'non renseignées')
    .replace('{{preferences_notes}}', ctx.preferences.notes ?? 'aucune')
    .replace('{{cooking_complexity}}', complexityLabel)
    .replace('{{diet_regime}}', regimeLabel)
    .replace('{{fish_rule}}', fishRule)
    .replace('{{menu_tier}}', tierLabel)
    .replace('{{favorite_meals}}', fmtFavorites(ctx.favoriteMeals))
    .replace('{{rated_meals}}', fmtRatings(ctx.recentRatings))
    .replace('{{recent_meals}}', fmtRecentMeals(ctx.recentWeeklyMeals))
    .replace('{{locations}}', fmtLocations(ctx.locations))
    .replace('{{pantry_targets}}', fmtPantry(ctx.pantryTargets))
    .replace('{{month_name}}', monthName)
    .replace('{{seasonal_produce}}', seasonalText)
    .replace('{{sunday_time_min}}', String(inputs.sunday_time_min))
    .replace('{{weekday_max_assembly_min}}', String(inputs.weekday_max_assembly_min))
    .replace('{{week_start_date}}', inputs.week_start_date)
}

export function buildUserMessage(inputs: GeneratePlanInput): string {
  const slots = inputs.covered_slots.join(', ')
  const envies = inputs.surprise_mode
    ? 'MODE SURPRISE — fais-moi découvrir quelque chose.'
    : inputs.cravings
      ? `Envies : ${inputs.cravings}`
      : 'Pas d\'envie particulière.'

  const lines = [
    `DEMANDE DE GÉNÉRATION`,
    `Semaine du : ${inputs.week_start_date} (lundi)`,
    `Créneaux à couvrir : ${slots}`,
    envies,
    `Petit-déjeuner inclus : ${inputs.include_breakfast ? 'oui' : 'non'}`,
    `Goûters inclus : ${inputs.include_snacks ? 'oui' : 'non'}`,
    `Desserts : ${inputs.dessert_mode}`,
    `Nombre de préparations dimanche : ${inputs.sunday_prep_count}`,
    `Temps dispo dimanche : ${inputs.sunday_time_min} min`,
    `Temps max assemblage semaine : ${inputs.weekday_max_assembly_min} min`,
    inputs.budget_eur ? `Budget cible : ${inputs.budget_eur} €` : 'Budget : non renseigné',
    inputs.free_note ? `Note libre : ${inputs.free_note}` : null,
    '',
    'Réponds uniquement en JSON valide selon le schéma fourni.',
  ]

  return lines.filter((l) => l !== null).join('\n')
}

// Message de régénération : base generate + plan précédent + feedback utilisateur
export function buildRegenerateUserMessage(
  inputs: GeneratePlanInput,
  feedback: string,
  previous: PlanOutput,
): string {
  const base = buildUserMessage(inputs).replace('DEMANDE DE GÉNÉRATION', 'DEMANDE DE RÉGÉNÉRATION')

  const prevPreps = previous.sunday_batch.preparations.length > 0
    ? previous.sunday_batch.preparations.map((p) => `  - ${p.name} (${p.time_min} min)`).join('\n')
    : '  (aucune)'

  const prevMeals = previous.daily_plan
    .filter((d) => d.lunch || d.dinner)
    .map((d) => {
      const parts = []
      if (d.lunch) parts.push(`midi=${d.lunch.meal}`)
      if (d.dinner) parts.push(`soir=${d.dinner.meal}`)
      return `  ${d.day} : ${parts.join(', ')}`
    })
    .join('\n') || '  (aucun repas)'

  return `${base}

FEEDBACK UTILISATEUR (à prendre en compte impérativement)
${feedback}

PLAN PRÉCÉDENT (à améliorer sur la base du feedback)
Philosophie : ${previous.philosophy_summary}
Prépas dimanche :
${prevPreps}
Repas de la semaine :
${prevMeals}

Améliore ce plan en tenant compte du feedback. Réponds uniquement en JSON valide.`
}

export function buildRetryMessage(validationError: string): string {
  return `Ta réponse précédente était invalide. Erreur :

${validationError}

Corrige et renvoie uniquement le JSON valide selon le schéma, sans préambule ni markdown.`
}
