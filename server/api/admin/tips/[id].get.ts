import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tip id' })
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

  const { data, error } = await supabase.from('tips').select(selectFields).eq('id', id).maybeSingle()
  if (error) {
    console.error('[admin/tips/[id].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return { tip: data }
})
