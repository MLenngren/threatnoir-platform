import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)

  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const normalizedStatus = status === 'draft' || status === 'published' ? status : null

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

  let db = supabase.from('tips').select(selectFields).order('created_at', { ascending: false })
  if (normalizedStatus) db = db.eq('status', normalizedStatus)

  const { data, error } = await db
  if (error) {
    console.error('[admin/tips/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: data ?? [] }
})
