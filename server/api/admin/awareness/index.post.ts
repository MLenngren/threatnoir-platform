import { createError, defineEventHandler, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Body = {
  id?: string
  title?: unknown
  body?: unknown
  prevention?: unknown
  framework_refs?: unknown
  article_id?: unknown
  tag_ids?: unknown
  status?: unknown
}

function cleanString(v: unknown, max: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  return s.slice(0, max)
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const body = (await readBody(event)) as Body

  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const title = cleanString(body?.title, 200)
  const lessonBody = typeof body?.body === 'string' ? body.body.trim() : ''
  const prevention = typeof body?.prevention === 'string' ? body.prevention.trim() : null
  const status = body?.status === 'published' ? 'published' : 'draft'

  const framework_refs = Array.isArray(body?.framework_refs)
    ? body.framework_refs
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean)
        .slice(0, 20)
    : []

  const article_id = typeof body?.article_id === 'string' && body.article_id.trim() ? body.article_id.trim() : null
  const tag_ids = Array.isArray(body?.tag_ids)
    ? Array.from(new Set(body.tag_ids.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()))).slice(
        0,
        12
      )
    : []

  if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
  if (!lessonBody.trim()) throw createError({ statusCode: 400, statusMessage: 'Missing body' })

  const patch: Record<string, unknown> = {
    title,
    body: lessonBody,
    prevention,
    framework_refs,
    article_id,
    status
  }

  let lessonId = id || null
  if (lessonId) {
    if (status === 'published') {
      const { data: existing, error: readErr } = await supabase
        .from('awareness_lessons')
        .select('published_at')
        .eq('id', lessonId)
        .maybeSingle()

      if (readErr) {
        console.error('[admin/awareness/index.post] DB error (published_at read):', readErr.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }

      patch.published_at = existing?.published_at ? existing.published_at : new Date().toISOString()
    } else {
      patch.published_at = null
    }

    const { data: updated, error } = await supabase
      .from('awareness_lessons')
      .update(patch)
      .eq('id', lessonId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[admin/awareness/index.post] DB error (update):', error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    if (!updated?.id) {
      throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })
    }
  } else {
    const { data: inserted, error } = await supabase
      .from('awareness_lessons')
      .insert({
        ...patch,
        status: status,
        published_at: status === 'published' ? new Date().toISOString() : null
      })
      .select('id')
      .single()

    if (error) {
      console.error('[admin/awareness/index.post] DB error (insert):', error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    lessonId = inserted.id
  }

  // Replace tag mapping
  const { error: delErr } = await supabase.from('awareness_lesson_tags').delete().eq('lesson_id', lessonId)
  if (delErr) {
    console.error('[admin/awareness/index.post] DB error (delete tags):', delErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (tag_ids.length) {
    const { error: tagErr } = await supabase
      .from('awareness_lesson_tags')
      .insert(tag_ids.map((tag_id) => ({ lesson_id: lessonId, tag_id })))
    if (tagErr) {
      console.error('[admin/awareness/index.post] DB error (tags):', tagErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  return { ok: true, id: lessonId }
})
