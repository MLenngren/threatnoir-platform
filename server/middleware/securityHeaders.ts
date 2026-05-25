import { defineEventHandler, setHeader } from 'h3'

export default defineEventHandler((event) => {
  // Content Security Policy (CSP)
  // NOTE: Nuxt renders some inline scripts/styles during SSR/hydration, so we allow 'unsafe-inline'
  // for now. Tightening this to nonces/hashes can be done later.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // Supabase client-side calls (REST/Auth) + Realtime (websocket)
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    // Podcast audio is hosted externally (e.g. Cloudflare R2 public URLs)
    "media-src 'self' https:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')

  setHeader(event, 'Content-Security-Policy', csp)

  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'X-XSS-Protection', '1; mode=block')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
})

