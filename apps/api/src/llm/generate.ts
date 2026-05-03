import type { GeneratePlanInput, PlanOutput } from '@cuistot/shared'
import { PlanOutputSchema } from '@cuistot/shared'
import { db } from '@/db'
import { llmLogs } from '@/db/schema'
import { logger } from '@/lib/logger'
import { anthropic } from './client'
import { buildRetryMessage, buildSystemPrompt, buildUserMessage, PROMPT_VERSION } from './prompt-builder'
import type { LlmLogKind, LlmUserContext } from './types'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8096

// Prix Claude Sonnet 4.6 (USD/token, source Anthropic pricing)
const INPUT_COST_USD_PER_TOKEN = 3 / 1_000_000
const OUTPUT_COST_USD_PER_TOKEN = 15 / 1_000_000
const USD_TO_EUR = 0.92

// ─── Helpers internes ─────────────────────────────────────────────────────────

function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  const block = response.content.find((b) => b.type === 'text')
  return block?.text ?? ''
}

// Si le LLM ignore la règle 10 et enveloppe sa réponse en markdown, on extrait le JSON.
function stripMarkdownFences(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : raw.trim()
}

function parseAndValidate(rawText: string): PlanOutput {
  const cleaned = stripMarkdownFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`Réponse LLM non parsable en JSON : ${e}`)
  }

  const result = PlanOutputSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Schéma PlanOutput invalide : ${result.error.message}`)
  }

  return result.data
}

function estimateCostEur(inputTokens: number, outputTokens: number): number {
  const usd = inputTokens * INPUT_COST_USD_PER_TOKEN + outputTokens * OUTPUT_COST_USD_PER_TOKEN
  return usd * USD_TO_EUR
}

async function writeLlmLog(params: {
  userId: string
  kind: LlmLogKind
  systemPrompt: string
  userPrompt: string
  rawResponse: string
  parsedJson: PlanOutput | null
  validationError: string | null
  inputTokens: number
  outputTokens: number
  latencyMs: number
}): Promise<void> {
  const costEur = estimateCostEur(params.inputTokens, params.outputTokens)
  await db.insert(llmLogs).values({
    userId: params.userId,
    kind: params.kind,
    promptVersion: PROMPT_VERSION,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    responseRaw: params.rawResponse,
    responseParsedJson: params.parsedJson ?? undefined,
    validationError: params.validationError ?? undefined,
    latencyMs: params.latencyMs,
    tokensInput: params.inputTokens,
    tokensOutput: params.outputTokens,
    costEstimateEur: String(costEur.toFixed(5)),
  })
}

// ─── Point d'entrée public ────────────────────────────────────────────────────

export async function generatePlan(
  context: LlmUserContext,
  inputs: GeneratePlanInput,
  userId: string,
  kind: LlmLogKind = 'generate_plan',
): Promise<PlanOutput> {
  const startMs = Date.now()
  const systemPrompt = buildSystemPrompt(context, inputs)
  const userPrompt = buildUserMessage(inputs)

  logger.info({ promptVersion: PROMPT_VERSION, kind }, 'llm: démarrage génération')

  let rawResponse = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0

  try {
    // ── Premier appel ──
    const resp1 = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    rawResponse = extractText(resp1)
    totalInputTokens += resp1.usage.input_tokens
    totalOutputTokens += resp1.usage.output_tokens

    let plan: PlanOutput
    try {
      plan = parseAndValidate(rawResponse)
    } catch (parseErr1) {
      // ── Retry unique ──
      logger.warn({ error: String(parseErr1) }, 'llm: premier parsing invalide, retry')

      const retryMsg = buildRetryMessage(String(parseErr1))
      const resp2 = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: rawResponse },
          { role: 'user', content: retryMsg },
        ],
      })

      rawResponse = extractText(resp2)
      totalInputTokens += resp2.usage.input_tokens
      totalOutputTokens += resp2.usage.output_tokens

      // Si invalide après retry, l'erreur est propagée vers le catch global
      plan = parseAndValidate(rawResponse)
    }

    const latencyMs = Date.now() - startMs
    logger.info({ latencyMs, inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, 'llm: succès')

    await writeLlmLog({
      userId, kind, systemPrompt, userPrompt, rawResponse,
      parsedJson: plan, validationError: null,
      inputTokens: totalInputTokens, outputTokens: totalOutputTokens, latencyMs,
    })

    return plan
  } catch (err) {
    const latencyMs = Date.now() - startMs
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error({ error: errMsg, latencyMs }, 'llm: échec définitif')

    await writeLlmLog({
      userId, kind, systemPrompt, userPrompt, rawResponse,
      parsedJson: null, validationError: errMsg,
      inputTokens: totalInputTokens, outputTokens: totalOutputTokens, latencyMs,
    })

    throw err
  }
}
