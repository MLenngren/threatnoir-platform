import { getHeader } from 'h3'
import type { H3Event } from 'h3'

type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: Math.max(0, maxRequests - 1) }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: Math.max(0, maxRequests - entry.count) }
}

export function getClientIP(event: H3Event): string {
  return (
    getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    getHeader(event, 'x-real-ip') ||
    'unknown'
  )
}

