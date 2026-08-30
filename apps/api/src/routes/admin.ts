import { desc, eq, sql } from 'drizzle-orm'
import { Router } from 'express'
import { AdminCreditsAdjustSchema, AdminSettingsUpdateSchema } from '@cuistot/shared'
import { db } from '@/db'
import { creditTransactions, llmLogs, users, weeklyPlans } from '@/db/schema'
import { adjustCredits } from '@/lib/credits'
import { BadRequestError, NotFoundError } from '@/lib/errors'
import { getSetting, setSetting } from '@/lib/settings'
import { DEFAULT_PROMPT_VERSION, PROMPT_REGISTRY } from '@/llm/prompts/registry'

export const adminRouter = Router()

// GET /api/admin/users — tous les comptes avec solde, nb de plans et coût LLM cumulé
adminRouter.get('/users', async (_req, res) => {
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      credits: users.credits,
      isAdmin: users.isAdmin,
      onboardingCompleted: users.onboardingCompleted,
      createdAt: users.createdAt,
      planCount: sql<number>`(SELECT COUNT(*)::int FROM ${weeklyPlans} WHERE ${weeklyPlans.userId} = ${users.id})`,
      llmCostEur: sql<string>`COALESCE((SELECT SUM(${llmLogs.costEstimateEur}) FROM ${llmLogs} WHERE ${llmLogs.userId} = ${users.id}), 0)::text`,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  res.json({ users: allUsers })
})

// POST /api/admin/users/:id/credits — ajustement du solde (+ ou -)
adminRouter.post('/users/:id/credits', async (req, res) => {
  const parsed = AdminCreditsAdjustSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')

  const target = await db.query.users.findFirst({
    where: eq(users.id, req.params.id),
    columns: { id: true },
  })
  if (!target) throw new NotFoundError('Utilisateur introuvable')

  const credits = await adjustCredits(
    req.params.id,
    parsed.data.delta,
    `admin_adjustment (par ${req.user.email})`,
  )

  res.json({ credits })
})

// GET /api/admin/users/:id/transactions — historique des mouvements de crédits
adminRouter.get('/users/:id/transactions', async (req, res) => {
  const transactions = await db.query.creditTransactions.findMany({
    where: eq(creditTransactions.userId, req.params.id),
    orderBy: desc(creditTransactions.createdAt),
    limit: 50,
  })
  res.json({ transactions })
})

// GET /api/admin/settings — réglages LLM actifs + versions de prompt disponibles
adminRouter.get('/settings', async (_req, res) => {
  const [llmModel, promptVersion] = await Promise.all([
    getSetting('llm_model', 'claude-sonnet-4-6'),
    getSetting('prompt_version', DEFAULT_PROMPT_VERSION),
  ])
  res.json({
    llm_model: llmModel,
    prompt_version: promptVersion,
    available_prompt_versions: Object.keys(PROMPT_REGISTRY),
  })
})

// PUT /api/admin/settings
adminRouter.put('/settings', async (req, res) => {
  const parsed = AdminSettingsUpdateSchema.safeParse(req.body)
  if (!parsed.success) throw new BadRequestError('Données invalides')

  const { llm_model: llmModel, prompt_version: promptVersion } = parsed.data

  if (promptVersion !== undefined && !PROMPT_REGISTRY[promptVersion]) {
    throw new BadRequestError(
      `Version de prompt inconnue. Disponibles : ${Object.keys(PROMPT_REGISTRY).join(', ')}`,
    )
  }

  if (llmModel !== undefined) await setSetting('llm_model', llmModel)
  if (promptVersion !== undefined) await setSetting('prompt_version', promptVersion)

  res.json({
    llm_model: await getSetting('llm_model', 'claude-sonnet-4-6'),
    prompt_version: await getSetting('prompt_version', DEFAULT_PROMPT_VERSION),
  })
})
