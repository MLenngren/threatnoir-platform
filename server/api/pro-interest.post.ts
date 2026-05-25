import { createError, defineEventHandler, readBody } from 'h3'

import { useSupabaseAdmin } from '../utils/supabase'
import { checkRateLimit, getClientIP } from '../utils/rateLimit'

type Body = {
  email?: unknown
  source?: unknown
  features_wanted?: unknown
  company_size?: unknown
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`pro-interest:${ip}`, 5, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const body = (await readBody(event)) as Body
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  const source = typeof body.source === 'string' ? body.source.slice(0, 100) : null
  const featuresWanted = Array.isArray(body.features_wanted)
    ? body.features_wanted.filter((f): f is string => typeof f === 'string').slice(0, 20)
    : []
  const companySize = typeof body.company_size === 'string' ? body.company_size.slice(0, 50) : null

  const supabase = useSupabaseAdmin()

  const { error } = await supabase
    .from('pro_interest')
    .upsert(
      { email, source, features_wanted: featuresWanted, company_size: companySize },
      { onConflict: 'email' }
    )

  if (error) {
    console.error('[pro-interest.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { ok: true }
})