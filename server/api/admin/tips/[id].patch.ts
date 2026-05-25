import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

type Body = {
  title?: unknown
  body?: unknown
  category_id?: unknown
  tags?: unknown
  author_name?: unknown
  status?: unknown
  featured?: unknown
}

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
    throw createError({ statusCode: 400, statusMessage: 'Invalid tip id' })
  }

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
    patch.title = title
  }

  if (typeof body?.body === 'string') {
    const tipBody = body.body.trim()
    if (!tipBody) throw createError({ statusCode: 400, statusMessage: 'Missing body' })
    patch.body = tipBody
  }

  if ('category_id' in (body ?? {})) {
    const categoryId = typeof body?.category_id === 'string' ? body.category_id.trim() : ''
    if (categoryId && !UUID_REGEX.test(categoryId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid category_id' })
    }
    patch.category_id = categoryId || null
  }

  if ('author_name' in (body ?? {})) {
    const authorName = typeof body?.author_name === 'string' ? body.author_name.trim() : ''
    if (!authorName) throw createError({ statusCode: 400, statusMessage: 'Missing author_name' })
    patch.author_name = authorName
  }

  if ('featured' in (body ?? {})) {
    if (typeof body?.featured !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Invalid featured' })
    patch.featured = body.featured
  }

  if ('status' in (body ?? {})) {
    const s = typeof body?.status === 'string' ? body.status.trim() : ''
    if (!s || !VALID_STATUS.has(s)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    patch.status = s
  }

  if ('tags' in (body ?? {})) {
    patch.tags = normalizeTags(body?.tags)
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const selectFields = [
    'id',
    'title',
    'body',
    'category_id',
    'tags',
    'author_name',
    'status',
    'featured',
    'created_at',
    'updated_at',
    'category:tip_categories!tips_category_id_fkey(id,name,slug,color)'
  ].join(',')

  const { data, error } = await supabase.from('tips').update(patch).eq('id', id).select(selectFields).single()
  if (error) {
    console.error('[admin/tips/[id].patch] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { tip: data }
})
