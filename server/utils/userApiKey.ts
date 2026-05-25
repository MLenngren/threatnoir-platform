import { createHash, randomBytes } from 'crypto'

// Key format: tn_live_<32 bytes hex>
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex')
  const key = `tn_live_${raw}`
  const hash = createHash('sha256').update(key).digest('hex')
  const prefix = key.slice(0, 16) + '...'
  return { key, hash, prefix }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}
