import { createError, defineEventHandler } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)

  const { data, error } = await supabase
    .from('x_accounts')
    .select('id,username,display_name,is_active,created_at')
    .order('username', { ascending: true })

	if (error) {
		console.error('[admin/x-accounts.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { accounts: data ?? [] }
})
