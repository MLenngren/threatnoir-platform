import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
  page?: string
  pageSize?: string
}

type AwarenessTag = {
  id: string
  name: string
  slug: string
  color: string | null
}

function normalizeTags(raw: unknown): AwarenessTag[] {
  if (!Array.isArray(raw)) return []
  const out: AwarenessTag[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const tag = (row as Record<string, unknown>).tag
    if (!tag || typeof tag !== 'object') continue
    const rec = tag as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id : null
    const slug = typeof rec.slug === 'string' ? rec.slug : null
    const name = typeof rec.name === 'string' ? rec.name : null
    if (!id || !slug || !name) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, name, slug, color: typeof rec.color === 'string' ? rec.color : null })
  }
  return out
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)

  const status = typeof query.status === 'string' ? query.status : 'all'
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25) || 25))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let db = supabase
    .from('awareness_lessons')
    .select(
      [
        'id',
        'article_id',
        'title',
        'body',
        'prevention',
        'framework_refs',
        'status',
        'created_at',
        'published_at',
        'article:articles(id,title,url)',
        'awareness_lesson_tags(tag:awareness_tags(id,name,slug,color))'
      ].join(','),
      { count: 'exact' }
    )
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status === 'draft' || status === 'published') {
    db = db.eq('status', status)
  }

  const { data, error, count } = await db
  if (error) {
    console.error('[admin/awareness/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items = (data ?? []).map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const tags = normalizeTags(rec.awareness_lesson_tags)
    const { awareness_lesson_tags, ...rest } = rec
    return { ...rest, tags }
  })

  return {
    page,
    pageSize,
    total: count ?? 0,
    items
  }
})
