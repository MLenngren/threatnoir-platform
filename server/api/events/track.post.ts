import { createError, defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'node:crypto'

import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  // Rate limit: max 60 events/min per IP
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`analytics:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const body = await readBody(event)

  const eventType = typeof body?.event_type === 'string' ? body.event_type.trim().slice(0, 50) : ''
  if (!eventType) {
    throw createError({ statusCode: 400, statusMessage: 'Missing event_type' })
  }

  const path = typeof body?.path === 'string' ? body.path.trim().slice(0, 500) : null
  const referrer = typeof body?.referrer === 'string' ? body.referrer.trim().slice(0, 500) : null
  const metadata = typeof body?.metadata === 'object' && body.metadata !== null ? body.metadata : {}
  const userAgent = String(event.node.req.headers['user-agent'] || '').slice(0, 500)

  // Hash IP for privacy (store only a short prefix)
  const ipHash = createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16)

  const supabase = serverSupabaseServiceRole(event)
  const { error } = await supabase.from('analytics_events').insert({
    event_type: eventType,
    path,
    referrer,
    metadata,
    ip_hash: ipHash,
    user_agent: userAgent
  })

  if (error) {
    console.error('[events/track.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { ok: true }
})
