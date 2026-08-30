import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { GeneratePlanInputSchema, RegeneratePlanInputSchema } from '@cuistot/shared'
import type { PlanOutput } from '@cuistot/shared'
import { db } from '@/db'
import { mealEntries, users, weeklyPlans } from '@/db/schema'
import type { NewMealEntry } from '@/db/schema'
import { consumeCredit } from '@/lib/credits'
import { BadRequestError, ConflictError, NotFoundError, PaymentRequiredError } from '@/lib/errors'
import { loadUserContext } from '@/llm/context-loader'
import { generatePlan } from '@/llm/generate'

export const plansRouter = Router()

// Fenêtre de régénération gratuite après la génération initiale
const FREE_REGEN_WINDOW_MS = 60_000

// POST /api/plans/generate
plansRouter.post('/generate', async (req, res) => {
  const parsed = GeneratePlanInputSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')
  const inputs = parsed.data
  const userId = req.user.id

  // Contrôle des crédits — les admins ne consomment pas
  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { credits: true, isAdmin: true },
  })
  if (!me) throw new NotFoundError('Utilisateur introuvable')
  if (!me.isAdmin && me.credits < 1) {
    throw new PaymentRequiredError('Plus de crédits disponibles. Rechargez votre compte pour générer un nouveau plan.')
  }

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

  // Décompte après succès : un échec LLM (500) ne coûte pas de crédit
  if (!me.isAdmin) await consumeCredit(userId, 'generate_plan')

  res.status(201).json({ plan, entries })
})

// POST /api/plans/:id/regenerate
plansRouter.post('/:id/regenerate', async (req, res) => {
  const parsed = RegeneratePlanInputSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')
  const { feedback } = parsed.data
  const userId = req.user.id

  const existing = await db.query.weeklyPlans.findFirst({
    where: and(eq(weeklyPlans.id, req.params.id), eq(weeklyPlans.userId, userId)),
  })
  if (!existing) throw new NotFoundError('Plan introuvable')

  // Régénération gratuite : 1 seule fois, dans la minute qui suit la génération payée.
  // Au-delà (ou après une regen gratuite), la régénération coûte 1 crédit.
  const ageMs = Date.now() - new Date(existing.createdAt).getTime()
  const isFreeRegen = existing.regenCount === 0 && ageMs < FREE_REGEN_WINDOW_MS

  const me = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { credits: true, isAdmin: true },
  })
  if (!me) throw new NotFoundError('Utilisateur introuvable')
  if (!isFreeRegen && !me.isAdmin && me.credits < 1) {
    throw new PaymentRequiredError('La régénération gratuite (1 minute) est passée et votre solde de crédits est à zéro. Rechargez votre compte.')
  }

  // Récupérer les inputs originaux (stockés dans inputsJson) et l'output précédent
  const inputs = GeneratePlanInputSchema.parse(existing.inputsJson)
  const previousOutput = existing.outputJson as PlanOutput

  const context = await loadUserContext(userId)
  const newOutput: PlanOutput = await generatePlan(
    context, inputs, userId,
    'regenerate_with_feedback',
    { feedback, previousPlanOutput: previousOutput },
  )

  // Archiver l'ancien plan, puis créer le nouveau
  await db
    .update(weeklyPlans)
    .set({ status: 'archived' })
    .where(eq(weeklyPlans.id, existing.id))

  const [newPlan] = await db
    .insert(weeklyPlans)
    .values({
      userId,
      weekStartDate: inputs.week_start_date,
      inputsJson: inputs,
      outputJson: newOutput,
      status: 'draft',
      // Regen payante = nouveau "achat" → rouvre une fenêtre de regen gratuite
      regenCount: isFreeRegen ? existing.regenCount + 1 : 0,
    })
    .returning()

  const entryRows: NewMealEntry[] = []
  for (const day of newOutput.daily_plan) {
    if (day.lunch) entryRows.push({ userId, planId: newPlan.id, slot: `${day.day}-midi`, mealLabel: day.lunch.meal, mealDataJson: day.lunch })
    if (day.dinner) entryRows.push({ userId, planId: newPlan.id, slot: `${day.day}-soir`, mealLabel: day.dinner.meal, mealDataJson: day.dinner })
  }

  const entries = entryRows.length > 0
    ? await db.insert(mealEntries).values(entryRows).returning()
    : []

  if (!isFreeRegen && !me.isAdmin) await consumeCredit(userId, 'regenerate_with_feedback')

  res.status(201).json({ plan: newPlan, entries })
})

// POST /api/plans/:id/finalize
plansRouter.post('/:id/finalize', async (req, res) => {
  const plan = await db.query.weeklyPlans.findFirst({
    where: and(eq(weeklyPlans.id, req.params.id), eq(weeklyPlans.userId, req.user.id)),
  })
  if (!plan) throw new NotFoundError('Plan introuvable')
  if (plan.status !== 'draft') throw new ConflictError(`Le plan est déjà ${plan.status}`)

  const [updated] = await db
    .update(weeklyPlans)
    .set({ status: 'active' })
    .where(eq(weeklyPlans.id, plan.id))
    .returning()

  res.json({ plan: updated })
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
