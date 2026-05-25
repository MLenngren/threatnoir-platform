import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'

type Body = {
  is_active?: boolean
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing account id' })

  const body = (await readBody(event)) as Body
  if (typeof body?.is_active !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Missing is_active' })
  }

  const { data, error } = await supabase
    .from('x_accounts')
    .update({ is_active: body.is_active })
    .eq('id', id)
    .select('id,username,display_name,is_active,created_at')
    .single()

	if (error) {
		console.error('[admin/x-accounts/[id].patch] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { account: data }
})
