import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw new Error('Missing social draft id')

  const { error } = await supabase
    .from('social_drafts')
    .update({ status: 'skipped' })
    .eq('id', id)

  if (error) {
    console.error('[admin/social/[id]/skip.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { skipped: true }
})
