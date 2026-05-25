import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { writeAuditLog } from '../../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })

  const { error } = await supabase.from('sources').delete().eq('id', id)
	if (error) {
		console.error('[admin/sources/[id].delete] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  await writeAuditLog({
    user_id: user.id,
    action: 'sources.delete',
    resource_type: 'source',
    resource_id: id
  })

  return { ok: true }
})
