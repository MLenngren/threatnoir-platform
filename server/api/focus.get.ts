import { createError, defineEventHandler } from 'h3'

import { attachArticlesToFocusItems } from '../utils/focusItems'
import { useSupabaseAdmin } from '../utils/supabase'

export default defineEventHandler(async () => {
  const supabase = useSupabaseAdmin()
  const nowIso = new Date().toISOString()

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

  const { data, error } = await supabase
    .from('focus_items')
    .select(selectFields)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[focus.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  try {
    const items = await attachArticlesToFocusItems(supabase, (data ?? []) as unknown as Array<{ article_ids?: unknown }>)
    return { items }
  } catch (e) {
    console.error('[focus.get] article join error:', e instanceof Error ? e.message : String(e))
    return { items: (data ?? []).map((i) => ({ ...i, articles: [] })) }
  }
})
