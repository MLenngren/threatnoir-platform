import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing account id' })

  const { error } = await supabase.from('x_accounts').delete().eq('id', id)
	if (error) {
		console.error('[admin/x-accounts/[id].delete] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { ok: true }
})
