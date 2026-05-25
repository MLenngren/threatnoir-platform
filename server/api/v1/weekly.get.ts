import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

type WeeklyQuery = {
  limit?: string
  offset?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`v1:weekly:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<WeeklyQuery>(event)

  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  const selectFields = [
    'week_label',
    'slug',
    'tldr',
    'date_from',
    'date_to',
    'published_at',
    'created_at'
  ].join(',')

  const { data, error } = await supabase
    .from('weekly_roundups')
    .select(selectFields)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[v1/weekly.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = Array.isArray(data) ? data : []
  const items = rows.map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    return {
      week_label: rec.week_label,
      slug: rec.slug,
      tldr: rec.tldr,
      date_from: rec.date_from,
      date_to: rec.date_to,
      published_at: rec.published_at
    }
  })

  return {
    items,
    nextOffset: offset + items.length,
    hasMore: rows.length === limit
  }
})
