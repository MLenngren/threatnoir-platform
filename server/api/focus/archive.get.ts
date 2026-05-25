import { createError, defineEventHandler, getQuery } from 'h3'

import { attachArticlesToFocusItems, VALID_FOCUS_CATEGORIES, VALID_FOCUS_SEVERITIES } from '../../utils/focusItems'
import { useSupabaseAdmin } from '../../utils/supabase'

type ArchiveQuery = {
  category?: string
  severity?: string
  limit?: string
  offset?: string
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = Number.parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

export default defineEventHandler(async (event) => {
  const supabase = useSupabaseAdmin()
  const q = getQuery<ArchiveQuery>(event)
  const nowIso = new Date().toISOString()

  const limit = clampInt(q.limit, 20, 1, 100)
  const offset = clampInt(q.offset, 0, 0, 50_000)

  const categoryRaw = typeof q.category === 'string' ? q.category.trim().toLowerCase() : ''
  const severityRaw = typeof q.severity === 'string' ? q.severity.trim().toLowerCase() : ''
  const category = categoryRaw && VALID_FOCUS_CATEGORIES.has(categoryRaw) ? categoryRaw : null
  const severity = severityRaw && VALID_FOCUS_SEVERITIES.has(severityRaw) ? severityRaw : null

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

  let db = supabase
    .from('focus_items')
    .select(selectFields, { count: 'exact' })
    .or(`status.eq.archived,and(status.eq.active,expires_at.lt.${nowIso})`)
    .order('created_at', { ascending: false })

  if (category) db = db.eq('category', category)
  if (severity) db = db.eq('severity', severity)

  const { data, error, count } = await db.range(offset, offset + limit - 1)
  if (error) {
    console.error('[focus/archive.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  try {
    const items = await attachArticlesToFocusItems(supabase, (data ?? []) as unknown as Array<{ article_ids?: unknown }>)
    return { items, total: count ?? 0 }
  } catch (e) {
    console.error('[focus/archive.get] article join error:', e instanceof Error ? e.message : String(e))
    return { items: (data ?? []).map((i) => ({ ...i, articles: [] })), total: count ?? 0 }
  }
})
