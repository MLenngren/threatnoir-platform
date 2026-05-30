import type { Provider } from './types.js'

import { claudeProvider } from './claude.js'
import { cliProvider } from './cli.js'
import { ollamaProvider } from './ollama.js'
import { openrouterProvider } from './openrouter.js'

let cachedProvider: Provider | null = null
let cachedKey: string | null = null

export function getProvider(): Provider {
  const key = (process.env.AI_PROVIDER || 'claude').trim().toLowerCase()
  if (cachedProvider && cachedKey === key) return cachedProvider

  let provider: Provider
  switch (key) {
    case 'claude':
      provider = claudeProvider
      break
    case 'cli':
      provider = cliProvider
      break
    case 'ollama':
      provider = ollamaProvider
      break
    case 'openrouter':
      provider = openrouterProvider
      break
    default:
      throw new Error(`[providers] unknown AI_PROVIDER=${key} (expected 'claude' | 'cli' | 'ollama' | 'openrouter')`)
  }

  cachedProvider = provider
  cachedKey = key

  // Keep logs grep-friendly for verification.
  console.log(`[providers] using AI_PROVIDER=${key}`)

  return provider
}
