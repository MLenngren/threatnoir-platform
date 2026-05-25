import { createError, defineEventHandler, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

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
  const body = (await readBody(event)) as Body

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : null
  const image_url = typeof body?.image_url === 'string' ? body.image_url.trim() : null
  const content_type = typeof body?.content_type === 'string' ? body.content_type.trim() : 'poster'
  const category = typeof body?.category === 'string' ? body.category.trim() : null
  const status = typeof body?.status === 'string' ? body.status.trim() : 'draft'
  const featured = typeof body?.featured === 'boolean' ? body.featured : false
  const tags = normalizeTags(body?.tags)

  if (!title) throw createError({ statusCode: 400, statusMessage: 'Missing title' })
  if (!VALID_TYPES.has(content_type)) throw createError({ statusCode: 400, statusMessage: 'Invalid content_type' })
  if (!VALID_STATUS.has(status)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })

  const insert: Record<string, unknown> = {
    title,
    description,
    image_url,
    content_type,
    category,
    tags,
    status,
    featured
  }
  if (status === 'published') insert.published_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('resources')
    .insert(insert)
    .select('id,title,description,image_url,content_type,category,tags,status,featured,created_at,published_at')
    .single()

  if (error) {
    console.error('[admin/resources/index.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { resource: data }
})
