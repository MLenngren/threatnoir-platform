import { createError, defineEventHandler } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  primary_count: number
  tag_count: number
}

function extractCount(v: unknown): number {
  // PostgREST aggregate embeds can come back as:
  // - [{ count: 12 }]
  // - [{ count: '12' }]
  // - { count: 12 }
  // Normalize to a number.
  const first = Array.isArray(v) ? v[0] : v
  if (!first || typeof first !== 'object') return 0
  const countRaw = (first as Record<string, unknown>).count
  const n = typeof countRaw === 'number' ? countRaw : Number(countRaw)
  return Number.isFinite(n) ? n : 0
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)

  const { data, error } = await supabase
    .from('categories')
    .select('id,name,slug,description,sort_order,articles!articles_category_id_fkey(count),article_tags(count)')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

	if (error) {
		console.error('[admin/categories.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  const categories: CategoryRow[] = (data ?? []).map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    return {
      id: String(rec.id ?? ''),
      name: String(rec.name ?? ''),
      slug: String(rec.slug ?? ''),
      description: typeof rec.description === 'string' ? rec.description : null,
      sort_order: typeof rec.sort_order === 'number' ? rec.sort_order : Number(rec.sort_order ?? 0) || 0,
      primary_count: extractCount(rec.articles),
      tag_count: extractCount(rec.article_tags)
    }
  })

  return { categories }
})
