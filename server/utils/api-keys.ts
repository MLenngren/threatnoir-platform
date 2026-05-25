import { randomBytes } from 'node:crypto'

// Format: tn_ + 64 hex chars
export function generateSubscriberApiKey(): string {
  return `tn_${randomBytes(32).toString('hex')}`
}
