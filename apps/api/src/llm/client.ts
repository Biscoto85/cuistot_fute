import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | undefined

// Initialisation paresseuse : n'échoue qu'à l'utilisation réelle, pas à l'import.
// Permet aux tests de mocker @/llm/client sans déclarer ANTHROPIC_API_KEY.
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export const anthropic = {
  get messages(): Anthropic['messages'] {
    return getClient().messages
  },
}
