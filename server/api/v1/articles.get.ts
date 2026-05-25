import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

type ArticlesQuery = {
  limit?: string
  offset?: string
  category?: string
  tag?: string
  q?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`v1:articles:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<ArticlesQuery>(event)

  const slugRegex = /^[a-z0-9-]+$/

  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)
  const categorySlug = (query.category ?? '').trim() || null
  const tagSlug = (query.tag ?? '').trim() || null
  const rawSearch = (query.q ?? '').trim()
  const search = rawSearch ? rawSearch.replace(/<[^>]*>/g, '').trim() || null : null

  if (categorySlug && !slugRegex.test(categorySlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category slug' })
  }

  if (tagSlug && !slugRegex.test(tagSlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category slug' })
  }

  if (search && search.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Search query too long (max 200 chars)' })
  }

  let categoryId: string | null = null
  if (categorySlug) {
    const categoryRes = await supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle()

    if (categoryRes.error) {
			console.error('[v1/articles.get] DB error:', categoryRes.error.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    if (!categoryRes.data) {
      return { items: [], hasMore: false, nextOffset: offset }
    }

    categoryId = categoryRes.data.id
  }

  let tagId: string | null = null
  if (tagSlug) {
    const tagRes = await supabase.from('categories').select('id').eq('slug', tagSlug).maybeSingle()

    if (tagRes.error) {
			console.error('[v1/articles.get] DB error:', tagRes.error.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    if (!tagRes.data) {
      return { items: [], hasMore: false, nextOffset: offset }
    }

    tagId = tagRes.data.id
  }

  const selectFields = [
    'id',
    'title',
    'url',
    'summary',
    'ai_summary',
	  'parent_article_id',
	  'relation_type',
    'image_url',
    'verify_count',
    'avg_score',
    'score_count',
    'published_at',
    'ingested_at',
    'source:sources(id,name,url)',
    'category:categories!articles_category_id_fkey(id,name,slug,description,icon)',
	  'article_tags(category:categories!article_tags_category_id_fkey(id,name,slug))',
	  'article_iocs!article_iocs_article_id_fkey(count)'
  ].join(',')

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

	function extractCount(v: unknown): number {
	  const first = Array.isArray(v) ? v[0] : v
	  if (!first || typeof first !== 'object') return 0
	  const countRaw = (first as Record<string, unknown>).count
	  const n = typeof countRaw === 'number' ? countRaw : Number(countRaw)
	  return Number.isFinite(n) ? n : 0
	}

  const normalizeItems = (rows: unknown[]) => {
    return (rows ?? []).map((row) => {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
	    const { article_tags: articleTags, article_iocs: articleIocs, ...rest } = rec
      const tags = extractTags(articleTags)
	    const ioc_count = extractCount(articleIocs)
	    return { ...rest, tags, ioc_count }
    })
  }

  if (categoryId || tagId) {
    const { data: idRows, error: idsError } = await supabase.rpc('get_approved_article_ids', {
      p_category_id: categoryId,
      p_tag_id: tagId,
      p_search: search,
      limit_count: limit + 1,
      offset_count: offset
    })

    if (idsError) {
			console.error('[v1/articles.get] DB error:', idsError.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const rows = Array.isArray(idRows) ? idRows : []
    const ids = rows
      .map((r) => {
        if (!r || typeof r !== 'object') return null
        const id = (r as Record<string, unknown>).id
        return typeof id === 'string' && id ? id : null
      })
      .filter((v): v is string => !!v)
    const hasMore = ids.length > limit
    const pageIds = hasMore ? ids.slice(0, limit) : ids
    if (!pageIds.length) {
      return { items: [], hasMore: false, nextOffset: offset }
    }

    const { data, error } = await supabase
      .from('articles')
      .select(selectFields)
      .eq('status', 'approved')
      .in('id', pageIds)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('ingested_at', { ascending: false })

    if (error) {
			console.error('[v1/articles.get] DB error:', error.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const items = normalizeItems(data ?? [])
    return {
      items,
      nextOffset: offset + items.length,
      hasMore
    }
  }

  let q = supabase
    .from('articles')
    .select(selectFields)
    .eq('status', 'approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })

  if (categoryId) {
    q = q.eq('category_id', categoryId)
  }

  if (search) {
    q = q.textSearch('fts', search, { type: 'websearch', config: 'english' })
  }

  const { data, error } = await q.range(offset, offset + limit - 1)

  if (error) {
		console.error('[v1/articles.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items = normalizeItems(data ?? [])
  return {
    items,
    nextOffset: offset + items.length,
    hasMore: items.length === limit
  }
})
