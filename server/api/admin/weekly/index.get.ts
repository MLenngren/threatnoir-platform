import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
  page?: string
  pageSize?: string
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)

  const status = typeof query.status === 'string' ? query.status : 'all'
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25) || 25))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const selectFields = [
    'id',
    'week_label',
    'slug',
    'date_from',
    'date_to',
    'tldr',
    'full_brief',
    'top_iocs',
    'awareness_links',
    'social_linkedin',
    'social_x',
    'article_count',
    'status',
    'created_at',
    'updated_at',
    'published_at'
  ].join(',')

  let db = supabase
    .from('weekly_roundups')
    .select(selectFields, { count: 'exact' })
    .order('date_from', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status === 'draft' || status === 'published') {
    db = db.eq('status', status)
  }

  const { data, error, count } = await db
  if (error) {
    console.error('[admin/weekly/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return {
    page,
    pageSize,
    total: count ?? 0,
    items: data ?? []
  }
})
