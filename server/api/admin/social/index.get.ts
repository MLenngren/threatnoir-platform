import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
}

type DraftRow = Record<string, unknown> & { article_ids?: unknown }

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)

  const status = typeof query.status === 'string' ? query.status.trim() : 'pending'

  let db = supabase
    .from('social_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (status && status !== 'all') {
    db = db.eq('status', status)
  }

  const { data, error } = await db
  if (error) {
    console.error('[admin/social/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as unknown as DraftRow[]
  const articleIdSet = new Set<string>()
  for (const r of rows) {
    const ids = Array.isArray(r.article_ids) ? r.article_ids : []
    for (const id of ids) {
      if (typeof id === 'string' && id) articleIdSet.add(id)
    }
  }

  const articleIds = Array.from(articleIdSet)
  const titleById = new Map<string, string>()
  if (articleIds.length) {
    const { data: articles, error: aErr } = await supabase
      .from('articles')
      .select('id,title')
      .in('id', articleIds)
      .limit(5000)

    if (aErr) {
      console.error('[admin/social/index.get] DB error (articles):', aErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    for (const a of (articles ?? []) as unknown[]) {
      if (!a || typeof a !== 'object') continue
      const rec = a as Record<string, unknown>
      const id = typeof rec.id === 'string' ? rec.id : ''
      const title = typeof rec.title === 'string' ? rec.title : ''
      if (id) titleById.set(id, title)
    }
  }

  const items = rows.map((r) => {
    const ids = Array.isArray(r.article_ids) ? (r.article_ids as unknown[]) : []
    const articles = ids
      .map((id) => (typeof id === 'string' ? id : ''))
      .filter(Boolean)
      .map((id) => ({ id, title: titleById.get(id) || '' }))

    return {
      ...r,
      articles
    }
  })

  return { items }
})
