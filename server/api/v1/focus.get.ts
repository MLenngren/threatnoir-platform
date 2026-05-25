import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

type FocusQuery = {
  severity?: string
  limit?: string
  offset?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`v1:focus:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<FocusQuery>(event)

  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)
  const rawSeverity = (query.severity ?? '').trim().toLowerCase() || null

  const allowedSeverities = new Set(['critical', 'high', 'medium', 'low'])
  if (rawSeverity && !allowedSeverities.has(rawSeverity)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid severity' })
  }

  const selectFields = [
    'id',
    'title',
    'slug',
    'summary',
    'severity',
    'category',
    'cve_ids',
    'affected_products',
    'action_required',
    'created_at',
    'expires_at'
  ].join(',')

  let q = supabase
    .from('focus_items')
    .select(selectFields)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (rawSeverity) {
    q = q.eq('severity', rawSeverity)
  }

  const { data, error } = await q.range(offset, offset + limit - 1)

  if (error) {
    console.error('[v1/focus.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items = Array.isArray(data) ? data : []
  return {
    items,
    nextOffset: offset + items.length,
    hasMore: items.length === limit
  }
})
