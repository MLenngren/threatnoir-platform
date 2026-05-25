import { defineEventHandler, getRouterParam } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')

  const [{ data: article, error: articleError }, { data: categories }] = await Promise.all([
    supabase
      .from('articles')
      .select(
        `
        id,title,url,status,avg_score,score_count,published_at,ingested_at,
        summary,ai_summary,category_id,
        source:sources ( id,name ),
	        category:categories!articles_category_id_fkey ( id,name,slug ),
	        article_tags ( category:categories!article_tags_category_id_fkey ( id, name, slug ) )
      `
      )
      .eq('id', id)
      .single(),
    supabase.from('categories').select('id,name,slug').order('sort_order', { ascending: true })
  ])

  if (articleError) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
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

	  const rec = article && typeof article === 'object' ? (article as Record<string, unknown>) : {}
	  const { article_tags: articleTags, ...rest } = rec
	  const tags = extractTags(articleTags)

	  return { article: { ...rest, tags }, categories: categories ?? [] }
})
