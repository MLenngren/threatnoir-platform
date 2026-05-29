import { getSiteConfig } from './siteConfig'

function normalizeBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

function safeToken(s: string): string {
  const raw = (s || '').trim().replace(/\s+/g, ' ')
  // Keep it predictable + header-safe.
  return raw.replace(/[^A-Za-z0-9._-]+/g, '-')
}

export function resolveHttpUserAgent(opts?: { suffix?: string }): string {
  const explicit = (process.env.HTTP_USER_AGENT || '').trim()
  if (explicit) return explicit

  const site = getSiteConfig()
  const siteUrl = normalizeBaseUrl(site.url) || 'https://example.com'
  const prefix = safeToken(site.name || 'Site')
  const name = opts?.suffix ? `${prefix}-${safeToken(opts.suffix)}` : prefix

  return `${name}/1.0 (+${siteUrl})`
}
