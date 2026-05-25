import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`reviews:detail:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const date = getRouterParam(event, 'date')
  const edition = getRouterParam(event, 'edition')

  if (!date || !edition) {
    throw createError({ statusCode: 400, statusMessage: 'Missing date or edition' })
  }

  const { data, error } = await supabase
    .from('podcast_episodes')
    .select('date, edition, title, article_text, audio_url, article_count, created_at, article_ids')
    .eq('date', date)
    .eq('edition', edition)
    .not('article_text', 'is', null)
    .maybeSingle()

  if (error) {
		console.error('[reviews/detail.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  const rawArticleIds = (data as unknown as { article_ids?: unknown }).article_ids
  const articleIds = Array.isArray(rawArticleIds) ? (rawArticleIds.filter((v) => typeof v === 'string') as string[]) : []

  type ArticleRow = { id: string; title: string; url: string }
  type ArticleIocRow = { article_id: string; type: string; value: string; context: string | null; created_at: string }

  let sources: Array<{ article_id: string; title: string; url: string; iocs: Array<{ type: string; value: string; context: string | null }> }> = []

  if (articleIds.length > 0) {
    const [{ data: iocRows, error: iocErr },] = await Promise.all([
      supabase
        .from('article_iocs')
        .select('article_id,type,value,context,created_at')
        .in('article_id', articleIds)
        .order('created_at', { ascending: false })
    ])

    if (iocErr) {
      console.error('[reviews/detail.get] DB error loading IOCs:', iocErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const byArticle = new Map<string, ArticleIocRow[]>()
    for (const row of (iocRows ?? []) as unknown as ArticleIocRow[]) {
      if (!row || typeof row.article_id !== 'string') continue
      const arr = byArticle.get(row.article_id)
      if (arr) arr.push(row)
      else byArticle.set(row.article_id, [row])
    }

    const iocArticleIds = articleIds.filter((id) => byArticle.has(id))

    if (iocArticleIds.length > 0) {
      const { data: articles, error: artErr } = await supabase
        .from('articles')
        .select('id,title,url')
        .in('id', iocArticleIds)

      if (artErr) {
        console.error('[reviews/detail.get] DB error loading source articles:', artErr.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }

      const articleMap = new Map<string, ArticleRow>()
      for (const a of (articles ?? []) as unknown as ArticleRow[]) {
        if (!a || typeof a.id !== 'string') continue
        articleMap.set(a.id, a)
      }

      sources = iocArticleIds.map((articleId) => {
        const a = articleMap.get(articleId)
        const iocs = (byArticle.get(articleId) ?? []).map((ioc) => ({
          type: ioc.type,
          value: ioc.value,
          context: ioc.context ?? null
        }))

        return {
          article_id: articleId,
          title: a?.title ?? 'Source article',
          url: a?.url ?? '',
          iocs
        }
      })
    }
  }

  // Do not expose article_ids publicly; only return derived sources.
  const { article_ids: _articleIds, ...rest } = data as unknown as Record<string, unknown>
  return { ...rest, sources }
})
