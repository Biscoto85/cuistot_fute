import type { GeneratePlanInput } from '@cuistot/shared'
import { PROMPT_VERSION, SYSTEM_PROMPT_TEMPLATE } from './prompts/system-v1'
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
      return `- ${t.name} : cible ${t.targetQuantity} ${t.unit}, rotation ${t.rotationMonths} mois, ${lastBought} (id: ${t.id})`
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

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: LlmUserContext, inputs: GeneratePlanInput): string {
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{{display_name}}', ctx.user.displayName)
    .replace('{{adults}}', String(ctx.household.adults))
    .replace('{{children}}', String(ctx.household.children))
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
    .replace('{{favorite_meals}}', fmtFavorites(ctx.favoriteMeals))
    .replace('{{rated_meals}}', fmtRatings(ctx.recentRatings))
    .replace('{{recent_meals}}', fmtRecentMeals(ctx.recentWeeklyMeals))
    .replace('{{locations}}', fmtLocations(ctx.locations))
    .replace('{{pantry_targets}}', fmtPantry(ctx.pantryTargets))
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

export function buildRetryMessage(validationError: string): string {
  return `Ta réponse précédente était invalide. Erreur :

${validationError}

Corrige et renvoie uniquement le JSON valide selon le schéma, sans préambule ni markdown.`
}
