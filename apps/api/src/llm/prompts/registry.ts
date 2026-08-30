import { SYSTEM_PROMPT_TEMPLATE as TEMPLATE_V4 } from './system-v4'
import { SYSTEM_PROMPT_TEMPLATE as TEMPLATE_V5 } from './system-v5'

// Versions sélectionnables par l'admin. Les versions v1-v3 sont exclues :
// leurs placeholders ne couvrent plus le contexte actuel (stock, régime, goûters).
export const PROMPT_REGISTRY: Record<string, string> = {
  v4: TEMPLATE_V4,
  v5: TEMPLATE_V5,
}

export const DEFAULT_PROMPT_VERSION = 'v5'
