import { runSandbox } from './runner'
import type { SandboxCommand } from './runner'

function parseArgs(argv: string[]): { command: SandboxCommand; flags: Record<string, string> } {
  const args = argv.slice(2)
  const command = args[0] as SandboxCommand
  if (!command || !['generate', 'regenerate', 'show-prompt'].includes(command)) {
    console.error('Usage: tsx src/index.ts <generate|regenerate|show-prompt> --user <id> --week <YYYY-MM-DD> [options]')
    process.exit(1)
  }

  const flags: Record<string, string> = {}
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      flags[key] = args[i + 1] ?? ''
      i++
    }
  }
  return { command, flags }
}

async function main() {
  const { command, flags } = parseArgs(process.argv)

  if (!flags['user']) {
    console.error('--user requis (ex: --user fx)')
    process.exit(1)
  }
  if (command !== 'show-prompt' && !flags['week']) {
    console.error('--week requis (ex: --week 2026-05-10)')
    process.exit(1)
  }

  await runSandbox({
    command,
    user: flags['user'],
    week: flags['week'] ?? new Date().toISOString().slice(0, 10),
    sundayTime: flags['sunday-time'] ? parseInt(flags['sunday-time'], 10) : undefined,
    envies: flags['envies'] || undefined,
    feedback: flags['feedback'] || undefined,
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
