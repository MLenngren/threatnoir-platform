import { createError, defineEventHandler } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type TagRow = {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)

  const [{ data: tags, error: tagsErr }, { data: lessons, error: lessonsErr }] = await Promise.all([
    supabase.from('awareness_tags').select('id,name,slug,description,color').order('name', { ascending: true }),
    supabase
      .from('awareness_lessons')
      .select('id,awareness_lesson_tags(tag_id)')
      .eq('status', 'published')
      .limit(5000)
  ])

  if (tagsErr) {
    console.error('[awareness/tags.get] DB error (tags):', tagsErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (lessonsErr) {
    console.error('[awareness/tags.get] DB error (lesson counts):', lessonsErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const counts = new Map<string, number>()
  for (const l of lessons ?? []) {
    const rec = l && typeof l === 'object' ? (l as Record<string, unknown>) : {}
    const rel = rec.awareness_lesson_tags
    if (!Array.isArray(rel)) continue
    const seenInLesson = new Set<string>()
    for (const row of rel) {
      if (!row || typeof row !== 'object') continue
      const tagId = (row as Record<string, unknown>).tag_id
      if (typeof tagId !== 'string' || !tagId) continue
      if (seenInLesson.has(tagId)) continue
      seenInLesson.add(tagId)
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }
  }

  const items: Array<TagRow & { lesson_count: number }> = (tags ?? []).map((t) => {
    const rec = t && typeof t === 'object' ? (t as Record<string, unknown>) : {}
    const id = String(rec.id ?? '')
    return {
      id,
      name: String(rec.name ?? ''),
      slug: String(rec.slug ?? ''),
      description: typeof rec.description === 'string' ? rec.description : null,
      color: typeof rec.color === 'string' ? rec.color : null,
      lesson_count: counts.get(id) ?? 0
    }
  })

  return { items }
})
