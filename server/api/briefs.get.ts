import { serverSupabaseServiceRole } from '#supabase/server'

import { checkRateLimit, getClientIP } from '../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`briefs:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const selectFields = [
    'id',
    'title',
    'brief',
    'url',
    'published_at',
    'ingested_at',
    'source:sources(id,name,url)',
    'category:categories!articles_category_id_fkey(id,name,slug)'
  ].join(',')

  const { data, error } = await supabase
    .from('articles')
    .select(selectFields)
    .eq('status', 'approved')
    .gte('relevance_score', 6)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[briefs.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: data ?? [] }
})

