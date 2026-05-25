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

  let db = supabase
    .from('resources')
    .select('id,title,description,image_url,content_type,category,tags,status,featured,created_at,published_at')
    .order('created_at', { ascending: false })

  if (normalizedStatus) db = db.eq('status', normalizedStatus)

  const { data, error } = await db
  if (error) {
    console.error('[admin/resources/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: data ?? [] }
})
