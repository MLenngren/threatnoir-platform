import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing submission id' })

  const { data, error } = await supabase.from('tip_submissions').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('[admin/tips/submissions/[id].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return { submission: data }
})
