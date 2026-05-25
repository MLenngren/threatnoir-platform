import { createError, defineEventHandler } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)

  const { data, error } = await supabase
    .from('sources')
    .select('id,name,url,type,is_active,last_fetched_at')
    .order('name', { ascending: true })

	if (error) {
		console.error('[admin/sources.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { sources: data ?? [] }
})
