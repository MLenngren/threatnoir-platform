import { createError, defineEventHandler, getQuery } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type AwarenessQuery = {
  tag?: string
  page?: string
  limit?: string
}

type AwarenessTag = {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
}

type AwarenessLessonRow = Record<string, unknown>

function slugOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s || null
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

function normalizeLesson(row: AwarenessLessonRow) {
  const lessonTags = (row.awareness_lesson_tags ?? row.lesson_tags ?? null) as unknown
  const { awareness_lesson_tags, lesson_tags, ...rest } = row
  const tags = normalizeTags(lessonTags)
  return { ...rest, tags }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<AwarenessQuery>(event)

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  const tagSlug = slugOrNull(query.tag)
  if (tagSlug && !slugRegex.test(tagSlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tag slug' })
  }

  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const from = (page - 1) * limit
  const to = from + limit // fetch 1 extra for hasMore

  let lessonIds: string[] | null = null
  if (tagSlug) {
    const tagRes = await supabase.from('awareness_tags').select('id').eq('slug', tagSlug).maybeSingle()
    if (tagRes.error) {
      console.error('[awareness/index.get] DB error (tag lookup):', tagRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    if (!tagRes.data?.id) {
      return { items: [], page, limit, hasMore: false }
    }

    const idsRes = await supabase
      .from('awareness_lesson_tags')
      .select('lesson_id')
      .eq('tag_id', tagRes.data.id)
      .limit(5000)

    if (idsRes.error) {
      console.error('[awareness/index.get] DB error (lesson ids):', idsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    lessonIds = (idsRes.data ?? [])
      .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>).lesson_id : null))
      .filter((v): v is string => typeof v === 'string' && !!v)

    if (lessonIds.length === 0) {
      return { items: [], page, limit, hasMore: false }
    }
  }

  let db = supabase
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
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (lessonIds) {
    db = db.in('id', lessonIds)
  }

  const { data, error } = await db.range(from, to)
  if (error) {
    console.error('[awareness/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = Array.isArray(data) ? (data as unknown as AwarenessLessonRow[]) : []
  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map(normalizeLesson)

  return {
    items,
    page,
    limit,
    hasMore
  }
})
