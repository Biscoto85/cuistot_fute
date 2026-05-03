import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  households,
  mealEntries,
  mealRatings,
  pantryTargets,
  userLocations,
  userPreferences,
  users,
  weeklyPlans,
} from '@/db/schema'
import type { LlmUserContext } from './types'

// Charge tout le contexte user nécessaire à la génération LLM.
// Données manquantes (foyer, préfs non renseignées) → valeurs par défaut.
export async function loadUserContext(userId: string): Promise<LlmUserContext> {
  const [user, household, preferences, locations, targets] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { displayName: true },
    }),
    db.query.households.findFirst({ where: eq(households.userId, userId) }),
    db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) }),
    db.query.userLocations.findMany({ where: eq(userLocations.userId, userId) }),
    db.query.pantryTargets.findMany({ where: eq(pantryTargets.userId, userId) }),
  ])

  if (!user) throw new Error(`Utilisateur ${userId} introuvable`)

  // Anti-répétition : labels des repas des 8 dernières semaines
  const recentPlans = await db.query.weeklyPlans.findMany({
    where: eq(weeklyPlans.userId, userId),
    orderBy: (t, { desc }) => desc(t.weekStartDate),
    limit: 8,
    columns: { id: true, weekStartDate: true },
  })

  let recentWeeklyMeals: LlmUserContext['recentWeeklyMeals'] = []
  if (recentPlans.length > 0) {
    const planIds = recentPlans.map((p) => p.id)
    const entries = await db.query.mealEntries.findMany({
      where: inArray(mealEntries.planId, planIds),
      columns: { planId: true, mealLabel: true },
    })

    const byPlan = new Map<string, string[]>()
    for (const e of entries) {
      const list = byPlan.get(e.planId) ?? []
      list.push(e.mealLabel)
      byPlan.set(e.planId, list)
    }

    recentWeeklyMeals = recentPlans.map((p) => ({
      weekStartDate: p.weekStartDate,
      mealLabels: byPlan.get(p.id) ?? [],
    }))
  }

  // Notations récentes (30 dernières, pour pondération LLM)
  const ratings = await db.query.mealRatings.findMany({
    where: eq(mealRatings.userId, userId),
    orderBy: (t, { desc }) => desc(t.ratedAt),
    limit: 30,
    columns: { mealLabel: true, rating: true, ratedAt: true },
  })

  // Repas favoris — deux étapes pour éviter un innerJoin inter-table (problème de types Drizzle)
  const userPlanIds = await db.query.weeklyPlans.findMany({
    where: eq(weeklyPlans.userId, userId),
    columns: { id: true },
    limit: 500,
  })

  const favorites = userPlanIds.length > 0
    ? await db.query.mealEntries.findMany({
        where: and(
          inArray(mealEntries.planId, userPlanIds.map((p) => p.id)),
          eq(mealEntries.isFavorite, true),
        ),
        orderBy: (t, { desc }) => desc(t.createdAt),
        limit: 20,
        columns: { mealLabel: true },
      })
    : []

  return {
    user: { displayName: user.displayName },
    household: {
      adults: household?.adults ?? 1,
      children: household?.children ?? 0,
      description: household?.description ?? null,
    },
    preferences: {
      loves: preferences?.loves ?? [],
      dislikes: preferences?.dislikes ?? [],
      allergies: preferences?.allergies ?? [],
      currentPhase: preferences?.currentPhase ?? null,
      dietaryTargets: preferences?.dietaryTargets ?? null,
      localSpecialties: preferences?.localSpecialties ?? null,
      notes: preferences?.notes ?? null,
    },
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      notes: l.notes ?? null,
    })),
    pantryTargets: targets.map((t) => ({
      id: t.id,
      name: t.name,
      targetQuantity: t.targetQuantity,
      unit: t.unit,
      rotationMonths: t.rotationMonths,
      lastPurchasedAt: t.lastPurchasedAt ?? null,
      priority: t.priority,
    })),
    recentWeeklyMeals,
    recentRatings: ratings.map((r) => ({
      mealLabel: r.mealLabel,
      rating: r.rating,
      ratedAt: r.ratedAt instanceof Date
        ? r.ratedAt.toISOString().slice(0, 10)
        : String(r.ratedAt).slice(0, 10),
    })),
    favoriteMeals: favorites.map((f) => ({ mealLabel: f.mealLabel })),
  }
}
