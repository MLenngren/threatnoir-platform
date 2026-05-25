import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing category id' })

  const [primaryRes, tagRes] = await Promise.all([
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('category_id', id),
    supabase.from('article_tags').select('article_id', { count: 'exact', head: true }).eq('category_id', id)
  ])

	if (primaryRes.error) {
		console.error('[admin/categories/[id].delete] DB error:', primaryRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}
	if (tagRes.error) {
		console.error('[admin/categories/[id].delete] DB error:', tagRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  const primaryCount = primaryRes.count ?? 0
  const tagCount = tagRes.count ?? 0
  if (primaryCount > 0 || tagCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Category is in use (${primaryCount} primary / ${tagCount} tagged)`
    })
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)
	if (error) {
		console.error('[admin/categories/[id].delete] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { ok: true }
})
