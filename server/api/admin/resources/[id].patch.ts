import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

type Body = {
  title?: unknown
  description?: unknown
  image_url?: unknown
  content_type?: unknown
  category?: unknown
  tags?: unknown
  status?: unknown
  featured?: unknown
}

const VALID_TYPES = new Set(['poster', 'infographic', 'cheat_sheet', 'guide'])
const VALID_STATUS = new Set(['draft', 'published'])

function normalizeTags(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, 50)
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid resource id' })
  }

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
    patch.title = title
  }
  if ('description' in (body ?? {})) {
    patch.description = typeof body?.description === 'string' ? body.description.trim() : null
  }
  if ('image_url' in (body ?? {})) {
    patch.image_url = typeof body?.image_url === 'string' ? body.image_url.trim() : null
  }
  if ('category' in (body ?? {})) {
    patch.category = typeof body?.category === 'string' ? body.category.trim() : null
  }
  if ('featured' in (body ?? {})) {
    if (typeof body?.featured !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Invalid featured' })
    patch.featured = body.featured
  }
  if ('content_type' in (body ?? {})) {
    const t = typeof body?.content_type === 'string' ? body.content_type.trim() : ''
    if (!t || !VALID_TYPES.has(t)) throw createError({ statusCode: 400, statusMessage: 'Invalid content_type' })
    patch.content_type = t
  }
  if ('tags' in (body ?? {})) {
    patch.tags = normalizeTags(body?.tags)
  }

  if ('status' in (body ?? {})) {
    const s = typeof body?.status === 'string' ? body.status.trim() : ''
    if (!s || !VALID_STATUS.has(s)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })

    patch.status = s
    if (s === 'published') {
      // Only set published_at if it isn't already set.
      const { data: existing, error: readErr } = await supabase.from('resources').select('published_at').eq('id', id).single()
      if (readErr) {
        console.error('[admin/resources/[id].patch] DB error (read):', readErr.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
      if (!existing?.published_at) {
        patch.published_at = new Date().toISOString()
      }
    }
    if (s !== 'published') {
      patch.published_at = null
    }
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const { data, error } = await supabase
    .from('resources')
    .update(patch)
    .eq('id', id)
    .select('id,title,description,image_url,content_type,category,tags,status,featured,created_at,published_at')
    .single()

  if (error) {
    console.error('[admin/resources/[id].patch] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { resource: data }
})
