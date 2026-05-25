import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { UUID_REGEX, getTokenFromQueryOrHeader } from '../../utils/subscriptions'

type UnsubQuery = {
  token?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`subscribe:delete:${ip}`, 30, 60 * 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid subscriber id' })
  }

  const query = getQuery<UnsubQuery>(event)
  const token = getTokenFromQueryOrHeader(event, query.token)
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
    console.error('[subscribe/[id].delete] DB error (lookup):', subRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!subRes.data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const delRes = await supabase.from('subscribers').delete().eq('id', id).eq('verify_token', token)
  if (delRes.error) {
    console.error('[subscribe/[id].delete] DB error (delete):', delRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { success: true, message: 'You have been unsubscribed' }
})
