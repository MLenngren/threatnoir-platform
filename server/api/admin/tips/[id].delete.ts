import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tip id' })
  }

  const { error } = await supabase.from('tips').delete().eq('id', id)
  if (error) {
    console.error('[admin/tips/[id].delete] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { deleted: true }
})
