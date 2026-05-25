import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

type AwarenessQuery = {
  q?: string
  limit?: string
  offset?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`v1:awareness:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<AwarenessQuery>(event)

  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)
  const rawSearch = (query.q ?? '').trim()
  const search = rawSearch ? rawSearch.replace(/<[^>]*>/g, '').trim() || null : null

  if (search && search.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Search query too long (max 200 chars)' })
  }

  const selectFields = ['id', 'title', 'slug', 'body', 'created_at'].join(',')

  let q = supabase
    .from('awareness_lessons')
    .select(selectFields)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (search) {
    q = q.ilike('title', `%${search}%`)
  }

  const { data, error } = await q.range(offset, offset + limit - 1)

  if (error) {
    console.error('[v1/awareness.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = Array.isArray(data) ? data : []
  const items = rows.map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const body = typeof rec.body === 'string' ? rec.body : ''
    return {
      title: rec.title,
      slug: rec.slug,
      excerpt: body.slice(0, 500),
      created_at: rec.created_at
    }
  })

  return {
    items,
    nextOffset: offset + items.length,
    hasMore: rows.length === limit
  }
})
