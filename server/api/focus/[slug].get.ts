import { createError, defineEventHandler, getRouterParam } from 'h3'

import { attachArticlesToFocusItems } from '../../utils/focusItems'
import { useSupabaseAdmin } from '../../utils/supabase'

type FocusItem = {
  id: string
  title: string
  slug: string
  summary: string
  severity: 'critical' | 'high' | 'medium'
  category: string
  cve_ids: string[]
  affected_products: string[]
  action_required: string | null
  article_ids: string[]
  ioc_summary: string | null
  source_urls: string[]
  status: 'pending' | 'active' | 'archived'
  expires_at: string | null
  created_at: string
  updated_at: string
  articles?: Array<{ id: string; title: string; url: string }>
}

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') || '').trim()
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  }

  const supabase = useSupabaseAdmin()

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
    .eq('slug', slug)
    .in('status', ['active', 'archived'])
    .maybeSingle()

  if (error) {
    console.error('[focus/[slug].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Focus item not found' })
  }

  try {
    const joined = await attachArticlesToFocusItems(supabase, [data as unknown as FocusItem])
    return { item: joined[0] }
  } catch (e) {
    console.error('[focus/[slug].get] article join error:', e instanceof Error ? e.message : String(e))
    return { item: { ...(data as unknown as FocusItem), articles: [] } }
  }
})
