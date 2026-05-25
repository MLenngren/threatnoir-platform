import { createError, defineEventHandler, getQuery } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type WeeklyQuery = {
  limit?: string
  offset?: string
}

function clampInt(v: unknown, def: number, min: number, max: number) {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : def
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, n))
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<WeeklyQuery>(event)

  const limit = clampInt(query.limit, 20, 1, 100)
  const offset = clampInt(query.offset, 0, 0, 50_000)

  const selectFields = [
    'id',
    'week_label',
    'slug',
    'date_from',
    'date_to',
    'tldr',
    'article_count',
    'status',
    'created_at',
    'published_at'
  ].join(',')

  const { data, error } = await supabase
    .from('weekly_roundups')
    .select(selectFields)
    .eq('status', 'published')
    .order('date_from', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[weekly/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: data ?? [] }
})
