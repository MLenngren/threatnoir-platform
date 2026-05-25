import { createError, defineEventHandler, readBody } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'

type Body = {
  ids: string[]
  status: 'pending' | 'approved' | 'rejected'
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const body = (await readBody(event)) as Body

  const ids = Array.isArray(body.ids) ? body.ids : []
  if (!ids.length) {
    return { updated: 0 }
  }

  const patch: Record<string, unknown> = { status: body.status }
  if (body.status === 'approved') {
    patch.published_at = new Date().toISOString()
  } else {
    patch.published_at = null
  }

  const { error, count } = await supabase
    .from('articles')
    .update(patch, { count: 'exact' })
    .in('id', ids)

	if (error) {
		console.error('[admin/articles/bulk.patch] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { updated: count ?? ids.length }
})
