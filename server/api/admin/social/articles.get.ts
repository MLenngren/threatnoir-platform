import { defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery(event)

  const since = typeof query.since === 'string' ? query.since : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('articles')
    .select('id,title,brief,ai_summary,relevance_score,published_at')
    .eq('status', 'approved')
    .or(`published_at.gte.${since},ingested_at.gte.${since}`)
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(30)

  if (error) {
    console.error('[admin/social/articles.get] DB error:', error.message)
    return []
  }

  return data ?? []
})
