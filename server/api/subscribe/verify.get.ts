import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { UUID_REGEX } from '../../utils/subscriptions'

type VerifyQuery = {
  token?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`subscribe:verify:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const query = getQuery<VerifyQuery>(event)
  const token = (query.token ?? '').trim()
  if (!token || !UUID_REGEX.test(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid token' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const subRes = await supabase.from('subscribers').select('id').eq('verify_token', token).maybeSingle()
  if (subRes.error) {
    console.error('[subscribe/verify.get] DB error (lookup):', subRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!subRes.data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const subscriberId = subRes.data.id

  const [subUpdate, chanUpdate] = await Promise.all([
    supabase.from('subscribers').update({ verified: true }).eq('id', subscriberId),
    supabase.from('subscriber_channels').update({ verified: true }).eq('subscriber_id', subscriberId)
  ])

  if (subUpdate.error) {
    console.error('[subscribe/verify.get] DB error (update subscriber):', subUpdate.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (chanUpdate.error) {
    console.error('[subscribe/verify.get] DB error (update channels):', chanUpdate.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return sendRedirect(event, '/subscribe/confirmed', 302)
})
