import { defineEventHandler, getRequestURL, getHeader, setResponseStatus, setResponseHeader } from 'h3'

import { getSiteConfig } from '../utils/siteConfig'

const BOT_PATTERNS = /bot|crawl|spider|facebookexternalhit|WhatsApp|Slurp|BingPreview|msnbot|Outlook|SafeLinks|Twitterbot|LinkedInBot/i

const GUARDED_PATHS = ['/auth/', '/admin/login']

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  // Only guard specific paths
  if (!GUARDED_PATHS.some((p) => path.startsWith(p))) return

  const ua = getHeader(event, 'user-agent') || ''
  if (!BOT_PATTERNS.test(ua)) return

  // Return a minimal HTML response for bots — no SSR rendering needed
  setResponseStatus(event, 200)
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
	return `<!DOCTYPE html><html><head><meta name="robots" content="noindex,nofollow"><title>${getSiteConfig().name}</title></head><body></body></html>`
})
