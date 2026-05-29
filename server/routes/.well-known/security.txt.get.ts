import { defineEventHandler, setResponseHeader } from 'h3'

import { getSiteConfig } from '../../utils/siteConfig'

function _formatExpires(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  // security.txt expects an RFC 3339-ish timestamp; ISO is acceptable in practice.
  return d.toISOString()
}

export default defineEventHandler((event) => {
  const site = getSiteConfig()

  const contactEmail = (process.env.SECURITY_CONTACT_EMAIL || process.env.NUXT_PUBLIC_CONTACT_EMAIL || '').trim()
  const contactUrl = (process.env.SECURITY_CONTACT_URL || '').trim()

  const contactLines: string[] = []
  if (contactEmail) contactLines.push(`Contact: mailto:${contactEmail}`)
  if (contactUrl) contactLines.push(`Contact: ${contactUrl}`)

  // Fall back to a generic, safe default.
  if (contactLines.length === 0) contactLines.push('Contact: mailto:security@example.com')

  const canonical = `${site.url}/.well-known/security.txt`
  const body = [
    ...contactLines,
    `Expires: ${_formatExpires(365)}`,
    'Preferred-Languages: en',
    `Canonical: ${canonical}`,
    ''
  ].join('\n')

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return body
})