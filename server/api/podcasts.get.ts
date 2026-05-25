import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`podcasts:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<{
    limit?: string
    offset?: string
    from?: string
    to?: string
  }>(event)

  function normalizeDateParam(name: 'from' | 'to', value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null

    // Allow full ISO (YYYY-MM-DDTHH:MM:SSZ) by taking the YYYY-MM-DD prefix.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
    if (!m) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} date` })
    }
    return m[1]
  }

  const from = normalizeDateParam('from', query.from)
  const to = normalizeDateParam('to', query.to)

  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  let db = supabase
    .from('podcast_episodes')
    .select('id, date, title, duration_seconds, audio_url, article_count, article_ids, created_at')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (from) db = db.gte('date', from)
  if (to) db = db.lte('date', to)

  const { data, error } = await db.range(offset, offset + limit - 1)

	if (error) {
		console.error('[podcasts.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return {
    items: data ?? [],
    nextOffset: offset + (data?.length ?? 0),
    hasMore: (data?.length ?? 0) === limit,
  }
})
