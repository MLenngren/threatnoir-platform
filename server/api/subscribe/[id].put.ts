import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import {
  UUID_REGEX,
  getBearerToken,
  normalizeInterests,
  preferencesFromInterests
} from '../../utils/subscriptions'

type Body = {
  interests?: unknown
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`subscribe:update:${ip}`, 60, 60 * 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid subscriber id' })
  }

  const token = getBearerToken(event)
  if (!token || !UUID_REGEX.test(token)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const subRes = await supabase
    .from('subscribers')
    .select('id')
    .eq('id', id)
    .eq('verify_token', token)
    .maybeSingle()

  if (subRes.error) {
    console.error('[subscribe/[id].put] DB error (lookup):', subRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!subRes.data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readBody<Body>(event)
  const interests = normalizeInterests(body?.interests ?? body)

  const delRes = await supabase.from('subscriber_preferences').delete().eq('subscriber_id', id)
  if (delRes.error) {
    console.error('[subscribe/[id].put] DB error (delete prefs):', delRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = preferencesFromInterests(id, interests)
  if (rows.length) {
    const { error: insErr } = await supabase.from('subscriber_preferences').insert(rows)
    if (insErr) {
      console.error('[subscribe/[id].put] DB error (insert prefs):', insErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  return { success: true }
})
