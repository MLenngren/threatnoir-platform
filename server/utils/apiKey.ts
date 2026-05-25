import { safeCompare } from './safeCompare'

export type ApiKeyScope = 'admin' | 'submit'

export function validateApiKey(key: string): { valid: boolean; scope: ApiKeyScope | null } {
  const provided = (key || '').trim()
  if (!provided) return { valid: false, scope: null }

  const raw = (process.env.THREATNOIR_API_KEYS || '').trim()
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
