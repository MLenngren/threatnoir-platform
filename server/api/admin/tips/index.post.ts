import { createError, defineEventHandler, readBody } from 'h3'

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
  const body = (await readBody(event)) as Body

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const tipBody = typeof body?.body === 'string' ? body.body.trim() : ''
  const categoryId = typeof body?.category_id === 'string' ? body.category_id.trim() : ''
  const authorName = typeof body?.author_name === 'string' ? body.author_name.trim() : 'ThreatNoir'
  const status = typeof body?.status === 'string' ? body.status.trim() : 'draft'
  const featured = typeof body?.featured === 'boolean' ? body.featured : false
  const tags = normalizeTags(body?.tags)

  if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
  if (!tipBody) throw createError({ statusCode: 400, statusMessage: 'Missing body' })
  if (!authorName) throw createError({ statusCode: 400, statusMessage: 'Missing author_name' })
  if (!VALID_STATUS.has(status)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })

  if (categoryId && !UUID_REGEX.test(categoryId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category_id' })
  }

  const insert: Record<string, unknown> = {
    title,
    body: tipBody,
    category_id: categoryId || null,
    tags,
    author_name: authorName,
    status,
    featured
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

  const { data, error } = await supabase.from('tips').insert(insert).select(selectFields).single()

  if (error) {
    console.error('[admin/tips/index.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { tip: data }
})
