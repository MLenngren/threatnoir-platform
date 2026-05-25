import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery(event)

  const status = typeof query.status === 'string' ? query.status : undefined
  const categoryId = typeof query.categoryId === 'string' ? query.categoryId : undefined
  const sourceId = typeof query.sourceId === 'string' ? query.sourceId : undefined

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25) || 25))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const sort = query.sort === 'published_at' ? 'published_at' : 'ingested_at'
  const order = query.order === 'asc' ? { ascending: true } : { ascending: false }

  let articlesQuery = supabase
    .from('articles')
    .select(
      `
      id,
      title,
      url,
      status,
	      relevance_score,
	    verify_count,
	    avg_score,
	    score_count,
      published_at,
      ingested_at,
      source:sources ( id, name ),
	      category:categories!articles_category_id_fkey ( id, name, slug ),
	      article_tags ( category:categories!article_tags_category_id_fkey ( id, name, slug ) )
    `,
      { count: 'exact' }
    )
    .order(sort, order)
    .range(from, to)

  if (status) articlesQuery = articlesQuery.eq('status', status)
  if (categoryId) articlesQuery = articlesQuery.eq('category_id', categoryId)
  if (sourceId) articlesQuery = articlesQuery.eq('source_id', sourceId)

  const [{ data: articles, error: articlesError, count }, { data: categories }, { data: sources }] =
    await Promise.all([
      articlesQuery,
      supabase.from('categories').select('id,name,slug').order('sort_order', { ascending: true }),
      supabase.from('sources').select('id,name,is_active,type').order('name', { ascending: true })
    ])

  if (articlesError) {
		console.error('[admin/articles.get] DB error:', articlesError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

	  type TagCategory = { id: string; name: string; slug: string }

	  const extractTags = (articleTags: unknown): TagCategory[] => {
	    if (!Array.isArray(articleTags)) return []
	    const map = new Map<string, TagCategory>()
	    for (const row of articleTags) {
	      if (!row || typeof row !== 'object') continue
	      const category = (row as Record<string, unknown>).category
	      if (!category || typeof category !== 'object') continue
	      const c = category as Record<string, unknown>
	      const id = typeof c.id === 'string' ? c.id : null
	      const slug = typeof c.slug === 'string' ? c.slug : null
	      const name = typeof c.name === 'string' ? c.name : null
	      if (!id || !slug || !name) continue
	      map.set(slug, { id, slug, name })
	    }
	    return Array.from(map.values())
	  }

	  const normalizedArticles = (articles ?? []).map((a) => {
	    const rec = a && typeof a === 'object' ? (a as Record<string, unknown>) : {}
	    const { article_tags: articleTags, ...rest } = rec
	    const tags = extractTags(articleTags)
	    return { ...rest, tags }
	  })

  return {
    page,
    pageSize,
    total: count ?? 0,
	    articles: normalizedArticles,
    categories: categories ?? [],
    sources: sources ?? []
  }
})
