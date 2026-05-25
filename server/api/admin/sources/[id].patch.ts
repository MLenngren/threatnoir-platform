import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { writeAuditLog } from '../../../utils/auditLog'

type Body = {
  name?: string
  url?: string
  is_active?: boolean
}

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if (typeof body?.name === 'string') patch.name = body.name.trim()
  if (typeof body?.url === 'string') patch.url = body.url.trim()
  if (typeof body?.is_active === 'boolean') patch.is_active = body.is_active

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  if (typeof patch.name === 'string' && !patch.name) {
    throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
  }
  if (typeof patch.url === 'string' && !patch.url) {
    throw createError({ statusCode: 400, statusMessage: 'URL cannot be empty' })
  }

  const { data, error } = await supabase
    .from('sources')
    .update(patch)
    .eq('id', id)
    .select('id,name,url,type,is_active,last_fetched_at')
    .single()

	if (error) {
		console.error('[admin/sources/[id].patch] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  await writeAuditLog({
    user_id: user.id,
    action: 'sources.update',
    resource_type: 'source',
    resource_id: id,
    details: { updated_fields: Object.keys(patch) }
  })

  return { source: data }
})
