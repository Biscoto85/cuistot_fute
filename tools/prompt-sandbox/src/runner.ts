import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { GeneratePlanInputSchema, PlanOutputSchema } from '@cuistot/shared'
import type { GeneratePlanInput, PlanOutput } from '@cuistot/shared'
import {
  buildSystemPrompt,
  buildUserMessage,
  buildRegenerateUserMessage,
  buildRetryMessage,
  PROMPT_VERSION,
} from '../../../apps/api/src/llm/prompt-builder'
import type { LlmUserContext } from '../../../apps/api/src/llm/types'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const LOGS_DIR = path.join(__dirname, '..', 'logs')

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8096
const INPUT_COST_USD_PER_TOKEN = 3 / 1_000_000
const OUTPUT_COST_USD_PER_TOKEN = 15 / 1_000_000
const USD_TO_EUR = 0.92

export type SandboxCommand = 'generate' | 'regenerate' | 'show-prompt'

export type SandboxOptions = {
  command: SandboxCommand
  user: string
  week: string
  sundayTime?: number
  envies?: string
  feedback?: string
}

function loadFixture(userId: string): LlmUserContext {
  const fixturePath = path.join(FIXTURES_DIR, `user-${userId}.json`)
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture introuvable : ${fixturePath}`)
  }
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as LlmUserContext
}

function buildInputs(opts: SandboxOptions): GeneratePlanInput {
  const raw = {
    week_start_date: opts.week,
    covered_slots: [
      'lundi-midi', 'lundi-soir',
      'mardi-midi', 'mardi-soir',
      'mercredi-midi', 'mercredi-soir',
      'jeudi-midi', 'jeudi-soir',
      'vendredi-midi', 'vendredi-soir',
    ],
    sunday_time_min: opts.sundayTime ?? 120,
    weekday_max_assembly_min: 15 as const,
    include_breakfast: true,
    surprise_mode: false,
    sunday_prep_count: 3 as const,
    cravings: opts.envies ?? null,
    budget_eur: null,
    free_note: null,
  }
  return GeneratePlanInputSchema.parse(raw)
}

function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  for (const block of response.content) {
    if (block.type === 'text' && block.text) return block.text
  }
  return ''
}

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1)
  return raw.trim()
}

function saveSandboxLog(data: object): string {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = path.join(LOGS_DIR, `${ts}.json`)
  fs.writeFileSync(logPath, JSON.stringify(data, null, 2))
  return logPath
}

export async function runSandbox(opts: SandboxOptions): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante dans l\'environnement')

  const client = new Anthropic({ apiKey })
  const ctx = loadFixture(opts.user)
  const inputs = buildInputs(opts)

  if (opts.command === 'show-prompt') {
    const systemPrompt = buildSystemPrompt(ctx, inputs)
    const userMsg = buildUserMessage(inputs)
    console.log('═══════════════════════════════════════')
    console.log('SYSTEM PROMPT')
    console.log('═══════════════════════════════════════')
    console.log(systemPrompt)
    console.log('\n═══════════════════════════════════════')
    console.log('USER MESSAGE')
    console.log('═══════════════════════════════════════')
    console.log(userMsg)
    console.log(`\nPrompt version : ${PROMPT_VERSION} | Modèle : ${MODEL}`)
    return
  }

  // Load previous plan for regenerate
  let previousPlan: PlanOutput | undefined
  if (opts.command === 'regenerate') {
    if (!opts.feedback) throw new Error('--feedback requis pour la régénération')
    // Look for most recent log for same user+week
    if (fs.existsSync(LOGS_DIR)) {
      const logs = fs.readdirSync(LOGS_DIR).sort().reverse()
      for (const logFile of logs) {
        try {
          const logData = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, logFile), 'utf-8'))
          if (logData.user === opts.user && logData.weekStartDate === opts.week && logData.parsedPlan) {
            previousPlan = logData.parsedPlan as PlanOutput
            console.log(`Plan précédent chargé depuis ${logFile}`)
            break
          }
        } catch {
          // skip malformed logs
        }
      }
    }
    if (!previousPlan) {
      throw new Error(`Aucun plan précédent trouvé pour user=${opts.user} week=${opts.week}. Générez d'abord avec 'generate'.`)
    }
  }

  const systemPrompt = buildSystemPrompt(ctx, inputs)
  const userMsg = opts.command === 'regenerate' && previousPlan
    ? buildRegenerateUserMessage(inputs, opts.feedback!, previousPlan)
    : buildUserMessage(inputs)

  console.log(`Génération en cours (${opts.command}, user=${opts.user}, semaine=${opts.week})…`)

  const startMs = Date.now()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  })

  const rawText = extractText(response)
  const jsonStr = extractJson(rawText)
  let parsedPlan: PlanOutput | null = null
  let parseError: string | null = null

  const parsed = PlanOutputSchema.safeParse(JSON.parse(jsonStr))
  if (parsed.success) {
    parsedPlan = parsed.data
  } else {
    parseError = parsed.error.message
    console.warn('⚠ Parsing échoué, tentative de retry…')

    const retryMsg = buildRetryMessage(parseError)
    const retryResponse = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMsg },
        { role: 'assistant', content: rawText },
        { role: 'user', content: retryMsg },
      ],
    })

    const retryRaw = extractText(retryResponse)
    const retryJson = extractJson(retryRaw)
    const retryParsed = PlanOutputSchema.safeParse(JSON.parse(retryJson))
    if (retryParsed.success) {
      parsedPlan = retryParsed.data
      parseError = null
      console.log('✓ Retry réussi')
    } else {
      parseError = retryParsed.error.message
      console.error('✗ Retry échoué aussi')
    }
  }

  const latencyMs = Date.now() - startMs
  const usage = response.usage
  const costEur = (
    (usage.input_tokens * INPUT_COST_USD_PER_TOKEN + usage.output_tokens * OUTPUT_COST_USD_PER_TOKEN) * USD_TO_EUR
  )

  const logData = {
    command: opts.command,
    user: opts.user,
    weekStartDate: opts.week,
    promptVersion: PROMPT_VERSION,
    model: MODEL,
    latencyMs,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    costEur: Math.round(costEur * 10000) / 10000,
    rawResponse: rawText,
    parseError,
    parsedPlan,
  }

  const logPath = saveSandboxLog(logData)

  console.log('\n═══════════════════════════════════════')
  console.log('RÉPONSE BRUTE')
  console.log('═══════════════════════════════════════')
  console.log(rawText.slice(0, 2000) + (rawText.length > 2000 ? '\n… (tronqué)' : ''))

  if (parsedPlan) {
    console.log('\n═══════════════════════════════════════')
    console.log('PLAN PARSÉ')
    console.log('═══════════════════════════════════════')
    console.log(JSON.stringify(parsedPlan, null, 2).slice(0, 3000))
  }

  console.log(`\n─────────────────────────────────────────`)
  console.log(`Tokens : ${usage.input_tokens} in + ${usage.output_tokens} out`)
  console.log(`Coût estimé : ${(costEur * 100).toFixed(2)} cts €`)
  console.log(`Latence : ${latencyMs} ms`)
  console.log(`Log : ${logPath}`)
  if (parseError) console.error(`Erreur parsing : ${parseError}`)
}
