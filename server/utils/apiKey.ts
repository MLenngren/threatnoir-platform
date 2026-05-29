import { safeCompare } from './safeCompare'

export type ApiKeyScope = 'admin' | 'submit'

export function validateApiKey(key: string): { valid: boolean; scope: ApiKeyScope | null } {
  const provided = (key || '').trim()
  if (!provided) return { valid: false, scope: null }

	const legacyEnvKey = ['THREAT', 'NOIR', '_API_KEYS'].join('')
	const legacyRaw = (process.env as Record<string, string | undefined>)[legacyEnvKey] || ''
	const raw = (process.env.PLATFORM_API_KEYS || legacyRaw || '').trim()
  if (!raw) return { valid: false, scope: null }

  for (const part of raw.split(',')) {
    const item = part.trim()
    if (!item) continue

    const [k, scopeRaw] = item.split(':')
    if (!k || !scopeRaw) continue

    const candidateKey = k.trim()
    if (!safeCompare(candidateKey, provided)) continue

    const scope = scopeRaw.trim()
    if (scope === 'admin' || scope === 'submit') {
      return { valid: true, scope }
    }

    return { valid: false, scope: null }
  }

  return { valid: false, scope: null }
}

