import type { Provider } from './types.js'

import { claudeProvider } from './claude.js'
import { cliProvider } from './cli.js'
import { ollamaProvider } from './ollama.js'
import { openrouterProvider } from './openrouter.js'

const providerCache = new Map<string, Provider>()
const resolvedKeyCache = new Map<string, string>()

export function getProvider(pipeline?: string): Provider {
  const pipelineName = typeof pipeline === 'string' ? pipeline.trim() : ''
  const cacheKey = pipelineName || '_default'

  const overrideEnvKey = pipelineName ? `AI_PROVIDER_${pipelineName.toUpperCase()}` : ''
  const overrideRaw = overrideEnvKey ? process.env[overrideEnvKey] : undefined
  const overrideKey = typeof overrideRaw === 'string' ? overrideRaw.trim().toLowerCase() : ''

  const globalRaw = process.env.AI_PROVIDER
  const globalKey = typeof globalRaw === 'string' && globalRaw.trim() ? globalRaw.trim().toLowerCase() : 'claude'

  const resolvedKey = overrideKey || globalKey
  const sourceEnv = overrideKey ? overrideEnvKey : 'AI_PROVIDER'

  const cachedProvider = providerCache.get(cacheKey)
  const cachedKey = resolvedKeyCache.get(cacheKey)
  if (cachedProvider && cachedKey === resolvedKey) return cachedProvider

  let provider: Provider
  switch (resolvedKey) {
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
      throw new Error(
        `[providers] unknown ${sourceEnv}=${resolvedKey} (expected 'claude' | 'cli' | 'ollama' | 'openrouter')`
      )
  }

  providerCache.set(cacheKey, provider)
  resolvedKeyCache.set(cacheKey, resolvedKey)

  // Keep logs grep-friendly for verification.
  if (pipelineName) {
    console.log(`[providers] pipeline=${pipelineName} → ${sourceEnv}=${resolvedKey}`)
  } else {
    // Backward-compat: preserve legacy log line when no pipeline is provided.
    console.log(`[providers] using AI_PROVIDER=${resolvedKey}`)
  }

  return provider
}
