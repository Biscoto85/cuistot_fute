import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { GeneratePlanInputSchema } from '@cuistot/shared'
import type { PlanOutput } from '@cuistot/shared'
import { db } from '@/db'
import { mealEntries, weeklyPlans } from '@/db/schema'
import type { NewMealEntry } from '@/db/schema'
import { BadRequestError, NotFoundError } from '@/lib/errors'
import { loadUserContext } from '@/llm/context-loader'
import { generatePlan } from '@/llm/generate'

export const plansRouter = Router()

// POST /api/plans/generate
plansRouter.post('/generate', async (req, res) => {
  const parsed = GeneratePlanInputSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')
  const inputs = parsed.data
  const userId = req.user.id

  // Chargement du contexte user (foyer, préfs, lieux, garde-manger, historique)
  const context = await loadUserContext(userId)

  // Appel LLM (retry intégré, log llm_logs automatique)
  const planOutput: PlanOutput = await generatePlan(context, inputs, userId)

  // Persistance du plan
  const [plan] = await db
    .insert(weeklyPlans)
    .values({
      userId,
      weekStartDate: inputs.week_start_date,
      inputsJson: inputs,
      outputJson: planOutput,
      status: 'draft',
    })
    .returning()

  // Persistance des meal_entries (un par créneau non-null dans daily_plan)
  const entryRows: NewMealEntry[] = []
  for (const day of planOutput.daily_plan) {
    if (day.lunch) {
      entryRows.push({
        userId,
        planId: plan.id,
        slot: `${day.day}-midi`,
        mealLabel: day.lunch.meal,
        mealDataJson: day.lunch,
      })
    }
    if (day.dinner) {
      entryRows.push({
        userId,
        planId: plan.id,
        slot: `${day.day}-soir`,
        mealLabel: day.dinner.meal,
        mealDataJson: day.dinner,
      })
    }
  }

  const entries = entryRows.length > 0
    ? await db.insert(mealEntries).values(entryRows).returning()
    : []

  res.status(201).json({ plan, entries })
})

// GET /api/plans — liste des plans du user, du plus récent au plus ancien
plansRouter.get('/', async (req, res) => {
  const plans = await db.query.weeklyPlans.findMany({
    where: eq(weeklyPlans.userId, req.user.id),
    orderBy: (t, { desc }) => desc(t.weekStartDate),
    columns: { id: true, weekStartDate: true, status: true, createdAt: true, updatedAt: true },
  })
  res.json({ plans })
})

// GET /api/plans/:id — détail d'un plan (avec output_json complet)
plansRouter.get('/:id', async (req, res) => {
  const plan = await db.query.weeklyPlans.findFirst({
    where: and(eq(weeklyPlans.id, req.params.id), eq(weeklyPlans.userId, req.user.id)),
  })
  if (!plan) throw new NotFoundError('Plan introuvable')
  res.json({ plan })
})
