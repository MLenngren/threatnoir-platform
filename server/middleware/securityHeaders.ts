import { defineEventHandler, setHeader } from 'h3'

function supabaseConnectSources(): string {
  // Derive allowed connect-src origins from the configured Supabase URL so the
  // CSP works for hosted Supabase (*.supabase.co) AND self-hosted/containerized
  // deployments (e.g. http://localhost:7100).
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  try {
    const u = new URL(url)
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${u.protocol}//${u.host} ${wsProto}//${u.host}`
  } catch {
    return 'https://*.supabase.co wss://*.supabase.co'
  }
}

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
    // Supabase client-side calls (REST/Auth) + Realtime (websocket).
    // Resolves to the configured Supabase origin, falling back to hosted Supabase.
    `connect-src 'self' ${supabaseConnectSources()}`,
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

