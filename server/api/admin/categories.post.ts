import { defineEventHandler, readBody, createError } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

type Body = {
  name?: string
  slug?: string
  description?: string | null
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase()
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const body = (await readBody(event)) as Body

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const slug = typeof body?.slug === 'string' ? normalizeSlug(body.slug) : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : null

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug format' })
  }

  const { data: existing, error: existingError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle()

	if (existingError) {
		console.error('[admin/categories.post] DB error:', existingError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}
  if (existing?.id) {
    throw createError({ statusCode: 409, statusMessage: 'Slug already exists' })
  }

  const { data: maxRow, error: maxError } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
	if (maxError) {
		console.error('[admin/categories.post] DB error:', maxError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  const nextSort = (typeof maxRow?.sort_order === 'number' ? maxRow.sort_order : Number(maxRow?.sort_order ?? -1) || -1) + 1

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, slug, description, sort_order: nextSort })
    .select('id,name,slug,description,sort_order')
    .single()

	if (error) {
		console.error('[admin/categories.post] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { category: data }
})
