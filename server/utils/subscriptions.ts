import { getHeader } from 'h3'
import type { H3Event } from 'h3'

// RFC 5321 compliant — stricter than the old regex, with length limit
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type InterestsInput = {
  categories?: unknown
  regulations?: unknown
  jurisdictions?: unknown
  companies?: unknown
  industries?: unknown
  freetext?: unknown
}

export type Interests = {
  categories: string[]
  regulations: string[]
  jurisdictions: string[]
  companies: string[]
  industries: string[]
  freetext: string[]
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

export function normalizeText(value: unknown, maxLen: number): string {
  const raw = typeof value === 'string' ? value : ''
  const cleaned = stripTags(raw.trim())
  if (!cleaned) return ''
  return cleaned.slice(0, Math.max(0, maxLen))
}

export function normalizeEmail(value: unknown): string {
  const raw = typeof value === 'string' ? value : ''
  return raw.trim().toLowerCase().slice(0, 254) // RFC 5321 max length
}

export function normalizeStringArray(value: unknown, opts: { maxItems: number; maxLen: number }): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (out.length >= opts.maxItems) break
    const v = normalizeText(item, opts.maxLen)
    if (!v) continue
    out.push(v)
  }
  // de-dupe (case-insensitive)
  const seen = new Set<string>()
  return out.filter((s) => {
    const k = s.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function normalizeInterests(input: unknown): Interests {
  const obj = (input && typeof input === 'object' ? (input as InterestsInput) : {})
  return {
    categories: normalizeStringArray(obj.categories, { maxItems: 50, maxLen: 64 }).map((s) => s.toLowerCase()),
    regulations: normalizeStringArray(obj.regulations, { maxItems: 50, maxLen: 64 }),
    jurisdictions: normalizeStringArray(obj.jurisdictions, { maxItems: 50, maxLen: 64 }),
    companies: normalizeStringArray(obj.companies, { maxItems: 50, maxLen: 128 }),
    industries: normalizeStringArray(obj.industries, { maxItems: 50, maxLen: 128 }),
    freetext: normalizeStringArray(obj.freetext, { maxItems: 25, maxLen: 200 })
  }
}

type PreferenceRow = {
  subscriber_id: string
  preference_type: 'category' | 'regulation' | 'jurisdiction' | 'company' | 'industry' | 'freetext'
  preference_value: string
}

export function preferencesFromInterests(subscriberId: string, interests: Interests): PreferenceRow[] {
  const rows: PreferenceRow[] = []

  for (const v of interests.categories) rows.push({ subscriber_id: subscriberId, preference_type: 'category', preference_value: v })
  for (const v of interests.regulations) rows.push({ subscriber_id: subscriberId, preference_type: 'regulation', preference_value: v })
  for (const v of interests.jurisdictions) rows.push({ subscriber_id: subscriberId, preference_type: 'jurisdiction', preference_value: v })
  for (const v of interests.companies) rows.push({ subscriber_id: subscriberId, preference_type: 'company', preference_value: v })
  for (const v of interests.industries) rows.push({ subscriber_id: subscriberId, preference_type: 'industry', preference_value: v })
  for (const v of interests.freetext) rows.push({ subscriber_id: subscriberId, preference_type: 'freetext', preference_value: v })

  return rows
}

export function getBearerToken(event: H3Event): string {
  const auth = getHeader(event, 'authorization')
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  return (token || '').trim()
}

export function getTokenFromQueryOrHeader(event: H3Event, queryToken?: unknown): string {
  const q = typeof queryToken === 'string' ? queryToken.trim() : ''
  const headerToken = (getHeader(event, 'token') || getHeader(event, 'x-verify-token') || '').trim()
  return q || headerToken || getBearerToken(event)
}
