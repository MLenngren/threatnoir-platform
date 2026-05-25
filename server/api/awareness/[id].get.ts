import { createError, defineEventHandler, getRouterParam } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type AwarenessTag = {
  id: string
  name: string
  slug: string
  description: string | null
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
    out.push({
      id,
      name,
      slug,
      description: typeof rec.description === 'string' ? rec.description : null,
      color: typeof rec.color === 'string' ? rec.color : null
    })
  }
  return out
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing lesson id' })

  const { data, error } = await supabase
    .from('awareness_lessons')
    .select(
      [
        'id',
	      'slug',
        'article_id',
        'title',
        'body',
        'prevention',
        'framework_refs',
        'status',
        'created_at',
        'published_at',
        'article:articles(id,title,url)',
        'awareness_lesson_tags(tag:awareness_tags(id,name,slug,description,color))'
      ].join(',')
    )
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[awareness/[id].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })
  }

  const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const tags = normalizeTags(rec.awareness_lesson_tags)
  const { awareness_lesson_tags, ...rest } = rec

  return { lesson: { ...rest, tags } }
})
