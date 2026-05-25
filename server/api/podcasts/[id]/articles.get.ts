import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`podcasts:articles:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const id = getRouterParam(event, 'id')

  // Get podcast episode to find article_ids
  const { data: episode, error: epErr } = await supabase
    .from('podcast_episodes')
    .select('article_ids')
    .eq('id', id)
    .single()

	if (epErr) {
		console.error('[podcasts/[id]/articles.get] DB error:', epErr.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}
	if (!episode) throw createError({ statusCode: 404, statusMessage: 'Episode not found' })

  const episodeRec = episode as Record<string, unknown>
  const rawIds = episodeRec.article_ids
  const articleIds = Array.isArray(rawIds) ? rawIds : []
  if (articleIds.length === 0) return { items: [] }

  // Fetch the articles
  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select('id, title, summary, url, image_url, relevance_score, created_at')
    .in('id', articleIds)

	if (artErr) {
		console.error('[podcasts/[id]/articles.get] DB error:', artErr.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { items: articles ?? [] }
})
