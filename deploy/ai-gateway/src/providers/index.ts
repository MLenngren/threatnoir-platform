import type { Provider } from './types.js'

import { claudeProvider } from './claude.js'
import { ollamaProvider } from './ollama.js'

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
    case 'ollama':
      provider = ollamaProvider
      break
    default:
      throw new Error(`[providers] unknown AI_PROVIDER=${key} (expected 'claude' | 'ollama')`)
  }

  cachedProvider = provider
  cachedKey = key

  // Keep logs grep-friendly for verification.
  console.log(`[providers] using AI_PROVIDER=${key}`)

  return provider
}
