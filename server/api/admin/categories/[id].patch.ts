import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'

type Body = {
  name?: string
  slug?: string
  description?: string | null
  sort_order?: number
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing category id' })

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if (typeof body?.name === 'string') patch.name = body.name.trim()
  if (typeof body?.slug === 'string') patch.slug = normalizeSlug(body.slug)
  if (typeof body?.description === 'string') patch.description = body.description.trim()
  if (body?.description === null) patch.description = null
  if (typeof body?.sort_order === 'number' && Number.isFinite(body.sort_order)) patch.sort_order = body.sort_order

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  if (typeof patch.name === 'string' && !patch.name) {
    throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
  }

  if (typeof patch.slug === 'string') {
    if (!patch.slug) throw createError({ statusCode: 400, statusMessage: 'Slug cannot be empty' })
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(patch.slug)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid slug format' })
    }

    const { data: existing, error: existingError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', patch.slug)
      .limit(1)
      .maybeSingle()
		if (existingError) {
			console.error('[admin/categories/[id].patch] DB error:', existingError.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
		}
    if (existing?.id && existing.id !== id) {
      throw createError({ statusCode: 409, statusMessage: 'Slug already exists' })
    }
  }

  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select('id,name,slug,description,sort_order')
    .single()

	if (error) {
		console.error('[admin/categories/[id].patch] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { category: data }
})
