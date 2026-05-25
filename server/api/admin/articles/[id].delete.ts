import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { writeAuditLog } from '../../../utils/auditLog'

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing article id' })

  const { error } = await supabase.from('articles').delete().eq('id', id)
	if (error) {
		console.error('[admin/articles/[id].delete] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  await writeAuditLog({
    user_id: user.id,
    action: 'articles.delete',
    resource_type: 'article',
    resource_id: id
  })

  return { deleted: true }
})
