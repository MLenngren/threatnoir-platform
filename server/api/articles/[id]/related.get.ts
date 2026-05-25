import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`articles:related:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing article id' })
  }

  const selectFields = [
    'id',
    'title',
    'url',
    'published_at',
    'ingested_at',
    'relation_type',
    'parent_article_id'
  ].join(',')

  const { data, error } = await supabase
    .from('articles')
    .select(selectFields)
    .eq('status', 'approved')
    .eq('parent_article_id', id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[articles/[id]/related.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: data ?? [] }
})
