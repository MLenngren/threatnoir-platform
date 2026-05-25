import { createError, defineEventHandler, getQuery } from 'h3'

import { attachArticlesToFocusItems, VALID_FOCUS_STATUSES } from '../../../utils/focusItems'
import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const q = getQuery<Query>(event)

  const statusRaw = typeof q.status === 'string' ? q.status.trim().toLowerCase() : ''
  const status = statusRaw && VALID_FOCUS_STATUSES.has(statusRaw) ? statusRaw : null

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
    'article_ids',
    'ioc_summary',
    'source_urls',
    'status',
    'expires_at',
    'created_at',
    'updated_at'
  ].join(',')

  let db = supabase.from('focus_items').select(selectFields).order('created_at', { ascending: false })
  if (status) db = db.eq('status', status)

  const { data, error } = await db
  if (error) {
    console.error('[admin/focus/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  try {
    const items = await attachArticlesToFocusItems(supabase, (data ?? []) as unknown as Array<{ article_ids?: unknown }>)
    return { items }
  } catch (e) {
    console.error('[admin/focus/index.get] article join error:', e instanceof Error ? e.message : String(e))
    return { items: (data ?? []).map((i) => ({ ...i, articles: [] })) }
  }
})
