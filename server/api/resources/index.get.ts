import { createError, defineEventHandler, getQuery } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type ResourcesQuery = {
  category?: string
  type?: string
  limit?: string
  offset?: string
}

const VALID_TYPES = new Set(['poster', 'infographic', 'cheat_sheet', 'guide'])

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<ResourcesQuery>(event)

  const limit = Math.min(Math.max(Number(query.limit ?? 24) || 24, 1), 100)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  const category = (query.category ?? '').trim() || null
  const type = (query.type ?? '').trim() || null

  if (type && !VALID_TYPES.has(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid type' })
  }

  let db = supabase
    .from('resources')
    .select('id,title,description,image_url,url,content_type,category,tags,status,featured,created_at,published_at')
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (category) db = db.eq('category', category)
  if (type) db = db.eq('content_type', type)

  const { data, error } = await db.range(offset, offset + limit - 1)
  if (error) {
    console.error('[resources/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items = (data ?? []) as unknown[]
  return {
    items,
    nextOffset: offset + items.length,
    hasMore: items.length === limit
  }
})
